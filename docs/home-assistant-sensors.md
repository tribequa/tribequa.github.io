# Publication des capteurs Home Assistant

Le site affiche les valeurs du fichier public `assets/data/sensors.json` et
l'historique 7 jours du fichier `assets/data/sensors-history.json`.
Home Assistant déclenche le workflow GitHub Actions `Update sensor data`, qui
réécrit ces fichiers et les commit sur la branche publiée par GitHub Pages.

## Formats attendus

Dernière mesure :

```json
{
  "updated_at": "2026-06-17T12:00:00+02:00",
  "sensors": {
    "indoor_temperature": { "value": 21.4, "unit": "°C" },
    "outdoor_temperature": { "value": 25.8, "unit": "°C" },
    "indoor_humidity": { "value": 48, "unit": "%" },
    "outdoor_humidity": { "value": 61, "unit": "%" }
  }
}
```

Historique :

```json
{
  "updated_at": "2026-06-17T12:00:00+02:00",
  "points": [
    {
      "time": "2026-06-17T12:00:00+02:00",
      "indoor_temperature": 21.4,
      "outdoor_temperature": 25.8,
      "indoor_humidity": 48,
      "outdoor_humidity": 61
    }
  ]
}
```

## Exemple Home Assistant

Créer un Personal Access Token GitHub avec le droit `contents: write` sur le dépôt,
puis le stocker dans `secrets.yaml`. Ce token sert uniquement à déclencher le
workflow ; le commit est fait côté GitHub avec `GITHUB_TOKEN`.

```yaml
github_sensor_authorization: "Bearer github_pat_xxxxxxxxxxxxxxxxxxxx"
```

Adapter les entités Home Assistant ci-dessous, puis ajouter la commande REST :

```yaml
rest_command:
  publish_tribequa_sensors:
    url: "https://api.github.com/repos/tribequa/tribequa.github.io/dispatches"
    method: POST
    content_type: "application/json"
    headers:
      Authorization: !secret github_sensor_authorization
      Accept: "application/vnd.github+json"
      X-GitHub-Api-Version: "2022-11-28"
    payload: >
      {
        "event_type": "update-sensors",
        "client_payload": {
          "updated_at": "{{ now().isoformat() }}",
          "indoor_temperature": {{ states("sensor.smart_thermometre_int_temperature") | float(default="null") }},
          "outdoor_temperature": {{ states("sensor.smart_thermometre_ext_temperature") | float(default="null") }},
          "indoor_humidity": {{ states("sensor.smart_thermometre_int_humidity") | float(default="null") }},
          "outdoor_humidity": {{ states("sensor.smart_thermometre_ext_humidity") | float(default="null") }}
        }
      }
```

Publier périodiquement les mesures :

```yaml
automation:
  - alias: Publier les capteurs Tribequa
    mode: single
    trigger:
      - platform: time_pattern
        minutes: "/15"
    action:
      - action: rest_command.publish_tribequa_sensors
```

Chaque appel ajoute un point à l'historique. Le workflow GitHub supprime
automatiquement les points de plus de 7 jours.
