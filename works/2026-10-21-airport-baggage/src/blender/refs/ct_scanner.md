# Hold baggage CT scanner (EDS)
Status: from knowledge, no images. All "verify".
- Real type: inline medical-style CT for checked bags; tunnel through a rotating X-ray gantry, lead curtains at both ends, in-line belt.
- Dimensions (verify): housing 2.0-2.4 m long x 1.4-1.7 m wide x 1.8-2.1 m high (vendor datasheets); tunnel 0.8-1.0 m wide x 0.6-0.8 m high; belt height 0.8 m; belt speed 0.2-0.5 m/s; throughput 400-1,800 bags/h; weight 2.5-4 t.
- App: housing 2.1 x 1.6 x 1.95 m, tunnel 0.95 x 0.75 m, belt top 0.8 m.
- Proportions: height to length 0.93; tunnel opening 59% of housing width.
- Parts: housing shell with chamfered corners, tunnel frames both ends, lead curtain strips, rotating gantry ring, status light stack, control panel, service door lines, feet.
- Moving: `ct_gantry` spins about X (flow axis). States: lamps idle / scanning / clear / alarm.
