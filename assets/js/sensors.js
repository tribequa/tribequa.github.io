(function () {
  var dashboard = document.querySelector("[data-sensors-src]");

  if (!dashboard) {
    return;
  }

  var updated = dashboard.querySelector("[data-sensors-updated]");
  var historyStatus = dashboard.querySelector("[data-sensors-history-status]");
  var source = dashboard.getAttribute("data-sensors-src");
  var historySource = dashboard.getAttribute("data-sensors-history-src");
  var sensorKeys = [
    "indoor_temperature",
    "outdoor_temperature",
    "indoor_humidity",
    "outdoor_humidity"
  ];
  var chartConfig = {
    temperature: {
      keys: ["indoor_temperature", "outdoor_temperature"],
      unit: "°C"
    },
    humidity: {
      keys: ["indoor_humidity", "outdoor_humidity"],
      unit: "%"
    }
  };
  var lineClassNames = {
    indoor_temperature: "sensor-chart__line--indoor",
    indoor_humidity: "sensor-chart__line--indoor",
    outdoor_temperature: "sensor-chart__line--outdoor",
    outdoor_humidity: "sensor-chart__line--outdoor"
  };

  function formatValue(sensor) {
    if (!sensor || sensor.value === null || sensor.value === undefined || sensor.value === "") {
      return "--";
    }

    var value = Number(sensor.value);
    var formatted = Number.isFinite(value)
      ? value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
      : sensor.value;

    return sensor.unit ? formatted + " " + sensor.unit : formatted;
  }

  function formatUpdatedAt(value) {
    if (!value) {
      return "Dernière mise à jour inconnue";
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Dernière mise à jour inconnue";
    }

    return "Mis à jour le " + date.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function isStale(value) {
    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return true;
    }

    return Date.now() - date.getTime() > 6 * 60 * 60 * 1000;
  }

  function setStatus(message, className) {
    if (updated) {
      updated.textContent = message;
    }

    if (className) {
      dashboard.classList.add(className);
    }
  }

  function setHistoryStatus(message, className) {
    if (historyStatus) {
      historyStatus.textContent = message;
    }

    if (className) {
      dashboard.classList.add(className);
    }
  }

  function createSvgElement(name, attributes) {
    var element = document.createElementNS("http://www.w3.org/2000/svg", name);

    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });

    return element;
  }

  function getNumericPoints(points, keys) {
    return (points || [])
      .map(function (point) {
        return {
          time: new Date(point.time),
          values: keys.reduce(function (values, key) {
            var value = Number(point[key]);
            values[key] = Number.isFinite(value) ? value : null;
            return values;
          }, {})
        };
      })
      .filter(function (point) {
        return !Number.isNaN(point.time.getTime()) && keys.some(function (key) {
          return point.values[key] !== null;
        });
      });
  }

  function getRange(values, paddingRatio) {
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);

    if (min === max) {
      min -= 1;
      max += 1;
    }

    var padding = (max - min) * paddingRatio;
    return {
      min: min - padding,
      max: max + padding
    };
  }

  function drawAxisLabels(svg, bounds, yRange, unit) {
    var labels = [
      { x: bounds.left, y: bounds.top + 4, text: yRange.max.toFixed(1) + " " + unit, anchor: "start" },
      { x: bounds.left, y: bounds.bottom, text: yRange.min.toFixed(1) + " " + unit, anchor: "start" },
      { x: bounds.left, y: bounds.height - 8, text: "J-7", anchor: "start" },
      { x: bounds.right, y: bounds.height - 8, text: "Maintenant", anchor: "end" }
    ];

    labels.forEach(function (label) {
      var text = createSvgElement("text", {
        x: label.x,
        y: label.y,
        "text-anchor": label.anchor,
        class: "sensor-chart__axis-label"
      });
      text.textContent = label.text;
      svg.appendChild(text);
    });
  }

  function drawChart(type, points) {
    var svg = dashboard.querySelector('[data-sensor-chart="' + type + '"]');
    var config = chartConfig[type];

    if (!svg || !config) {
      return false;
    }

    var numericPoints = getNumericPoints(points, config.keys);
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 720 260");

    if (numericPoints.length < 2) {
      svg.appendChild(createSvgElement("text", {
        x: 360,
        y: 130,
        "text-anchor": "middle",
        class: "sensor-chart__empty"
      }));
      svg.lastChild.textContent = "Pas encore assez de points";
      return false;
    }

    var bounds = {
      left: 46,
      top: 18,
      right: 700,
      bottom: 214,
      width: 720,
      height: 260
    };
    var times = numericPoints.map(function (point) {
      return point.time.getTime();
    });
    var minTime = Math.min.apply(null, times);
    var maxTime = Math.max.apply(null, times);
    var values = [];

    numericPoints.forEach(function (point) {
      config.keys.forEach(function (key) {
        if (point.values[key] !== null) {
          values.push(point.values[key]);
        }
      });
    });

    var yRange = getRange(values, 0.08);
    var scaleX = function (time) {
      if (minTime === maxTime) {
        return bounds.left;
      }

      return bounds.left + ((time - minTime) / (maxTime - minTime)) * (bounds.right - bounds.left);
    };
    var scaleY = function (value) {
      return bounds.bottom - ((value - yRange.min) / (yRange.max - yRange.min)) * (bounds.bottom - bounds.top);
    };

    [0, 0.5, 1].forEach(function (ratio) {
      var y = bounds.top + ratio * (bounds.bottom - bounds.top);
      svg.appendChild(createSvgElement("line", {
        x1: bounds.left,
        x2: bounds.right,
        y1: y,
        y2: y,
        class: "sensor-chart__gridline"
      }));
    });

    config.keys.forEach(function (key) {
      var pathParts = [];

      numericPoints.forEach(function (point) {
        var value = point.values[key];

        if (value === null) {
          return;
        }

        pathParts.push(
          (pathParts.length === 0 ? "M " : "L ") +
          scaleX(point.time.getTime()).toFixed(1) +
          " " +
          scaleY(value).toFixed(1)
        );
      });

      if (pathParts.length > 1) {
        svg.appendChild(createSvgElement("path", {
          d: pathParts.join(" "),
          class: "sensor-chart__line " + lineClassNames[key],
          fill: "none"
        }));
      }
    });

    drawAxisLabels(svg, bounds, yRange, config.unit);
    return true;
  }

  function loadHistory() {
    if (!historySource) {
      return;
    }

    fetch(historySource + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Sensor history request failed");
        }

        return response.json();
      })
      .then(function (data) {
        var points = data.points || [];
        var hasTemperature = drawChart("temperature", points);
        var hasHumidity = drawChart("humidity", points);

        if (hasTemperature || hasHumidity) {
          setHistoryStatus(points.length + " points conservés sur 7 jours");
        } else {
          setHistoryStatus("L'historique apparaîtra après quelques mises à jour");
        }
      })
      .catch(function () {
        setHistoryStatus("Historique temporairement indisponible", "sensors-dashboard--error");
      });
  }

  fetch(source + "?v=" + Date.now(), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Sensor data request failed");
      }

      return response.json();
    })
    .then(function (data) {
      var sensors = data.sensors || {};

      sensorKeys.forEach(function (key) {
        var element = dashboard.querySelector('[data-sensor-value="' + key + '"]');

        if (element) {
          element.textContent = formatValue(sensors[key]);
        }
      });

      setStatus(formatUpdatedAt(data.updated_at));

      if (isStale(data.updated_at)) {
        dashboard.classList.add("sensors-dashboard--stale");
        setStatus(formatUpdatedAt(data.updated_at) + " - données anciennes");
      }
    })
    .catch(function () {
      sensorKeys.forEach(function (key) {
        var element = dashboard.querySelector('[data-sensor-value="' + key + '"]');

        if (element) {
          element.textContent = "--";
        }
      });

      setStatus("Données temporairement indisponibles", "sensors-dashboard--error");
    });

  loadHistory();
})();
