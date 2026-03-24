// espModel.js — defines the shape of an ESP32 ECU energy frame
// Field names match the Python simulator (and will match the real ESP32)

export const ECUSchema = {
  ecu_serial:      'INTEGER',  // unique identifier of the ESP32 sending the data
  timestamp:       'TEXT',     // ISO timestamp from simulator / time from boot on real ESP32
  voltage_samples: 'TEXT',     // JSON array of 10 raw ADC readings in millivolts (0-3300mV)
  avg_voltage:     'REAL',     // scaled real voltage calculated by server (V_real = 22.3 * V_sens)
  avg_current:     'REAL',     // scaled real current — not yet sent, placeholder
  penalty:         'INTEGER',  // 0 = fine, 1 = exceeded 2kW power limit
  recorded_at:     'TEXT',     // ISO timestamp of when server received the frame
};

// Expected POST body from simulator / ESP32:
// {
//   ecu_serial: 12345,
//   timestamp: "2026-03-25T00:00:00.000Z",
//   voltage_samples: [2200, 2250, 2230, 2210, 2260, 2240, 2220, 2270, 2250, 2230]
// }