# Publication des capteurs Home Assistant

Le site affiche les valeurs du fichier public `assets/data/sensors.json`.
Home Assistant déclenche le workflow GitHub Actions `Update sensor data`, qui
réécrit ce fichier et le commit sur la branche publiée par GitHub Pages.

## Format attendu

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

## Exemple Home Assistant

Créer un Personal Access Token GitHub avec le droit `contents: write` sur le dépôt,
puis le stocker dans `secrets.yaml`. Ce token sert uniquement à déclencher le
workflow ; le commit est fait côté GitHub avec `GITHUB_TOKEN`.

```yaml
github_sensor_token: ghp_xxxxxxxxxxxxxxxxxxxx
```

Adapter les entités Home Assistant ci-dessous, puis ajouter la commande REST :

```yaml
rest_command:
  publish_tribequa_sensors:
    url: "https://api.github.com/repos/OWNER/REPO/dispatches"
    method: POST
    headers:
      Authorization: "Bearer {{ token }}"
      Accept: "application/vnd.github+json"
      X-GitHub-Api-Version: "2026-03-10"
    payload: >
      {
        "event_type": "update-sensors",
        "client_payload": {
          "updated_at": "{{ now().isoformat() }}",
          "indoor_temperature": {{ states("sensor.temperature_interieure") | float(default="null") }},
          "outdoor_temperature": {{ states("sensor.temperature_exterieure") | float(default="null") }},
          "indoor_humidity": {{ states("sensor.humidite_interieure") | float(default="null") }},
          "outdoor_humidity": {{ states("sensor.humidite_exterieure") | float(default="null") }}
        }
      }
```

Publier périodiquement les mesures :

```yaml
automation:
  - alias: Publier les capteurs Tribequa
    trigger:
      - platform: time_pattern
        minutes: "/15"
    action:
      - service: rest_command.publish_tribequa_sensors
        data:
          token: !secret github_sensor_token
```

Remplacer `OWNER/REPO` par le dépôt GitHub réel et les quatre `sensor.*` par les
entités Home Assistant à publier.
