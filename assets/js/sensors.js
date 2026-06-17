(function () {
  var dashboard = document.querySelector("[data-sensors-src]");

  if (!dashboard) {
    return;
  }

  var updated = dashboard.querySelector("[data-sensors-updated]");
  var source = dashboard.getAttribute("data-sensors-src");
  var sensorKeys = [
    "indoor_temperature",
    "outdoor_temperature",
    "indoor_humidity",
    "outdoor_humidity"
  ];

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
})();
