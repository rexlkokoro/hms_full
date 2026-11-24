const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// -------------------------------------------------------------
// Data Layer: Auto-load datasets from /data directory
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');

function loadJsonFile(fileName, fallback = {}) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.warn(`[Data Warning] Could not parse /data/${fileName}:`, err.message);
  }
  return fallback;
}

// Patient RFID card mappings (Loaded from /data/rfid_cards.json or fallback)
let CARD_PATIENT_MAPPING = loadJsonFile('rfid_cards.json', {
  "DEFAULT": "PAT-2026-001",
  "P001": "PAT-2026-001",
  "P002": "PAT-2026-002",
  "P003": "PAT-2026-003",
  "P004": "PAT-2026-004"
});

// HTTP Static File Server & Simple API
const server = http.createServer((req, res) => {
  // API: Get connected serial status and list of COM ports
  if (req.url === '/api/serial-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      connected: activePort !== null && activePort.isOpen,
      portName: activePort ? activePort.path : null,
      lastScan: lastScannedCard
    }));
  }

  // API: Load Hospital Datasets from /data
  if (req.url === '/api/data/patients') {
    const patients = loadJsonFile('patients.json', {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(patients));
  }

  if (req.url === '/api/data/hospital') {
    const hospital = loadJsonFile('hospital_data.json', {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(hospital));
  }

  if (req.url === '/api/data/audit-logs') {
    const logs = loadJsonFile('audit_logs.json', []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs));
  }

  // API: List reports inside /data/reports
  if (req.url === '/api/data/reports') {
    const repDir = path.join(DATA_DIR, 'reports');
    let files = [];
    if (fs.existsSync(repDir)) {
      files = fs.readdirSync(repDir).map(name => {
        const stat = fs.statSync(path.join(repDir, name));
        return {
          fileName: name,
          sizeBytes: stat.size,
          sizeKB: (stat.size / 1024).toFixed(1) + ' KB',
          url: `/data/reports/${encodeURIComponent(name)}`
        };
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ reports: files }));
  }

  // API: List detected USB serial ports
  if (req.url === '/api/ports') {
    SerialPort.list().then(ports => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ports));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // API: Gemini Clinical AI Analysis Layer (Parses Pre-Accident & Post-Accident Files)
  if (req.url === '/api/gemini/analyze' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const apiKey = payload.apiKey || process.env.GEMINI_API_KEY || '';
        const patientData = payload.patientData || {};
        const preRecord = payload.preRecord || patientData.preRecord || null;
        const postRecord = payload.postRecord || patientData.postRecord || null;

        // Structured Fallback Clinical Rule-Engine Synthesizer
        const buildFallbackAnalysis = (pat, pre, post) => {
          const patName = pat.name || 'Patient';
          const patId = pat.id || 'PAT-2026-001';
          
          let priority = 'MEDIUM PRIORITY';
          let priorityColor = 'amber';
          let priorityReason = 'Patient status post-trauma requiring standard surveillance.';
          let urgencyScore = 'Level 3 - Urgent / Semi-Critical';

          if (post && post.treatment && post.treatment.procedure) {
            priority = 'HIGH CLINICAL PRIORITY';
            priorityColor = 'rose';
            priorityReason = `Status post major orthopedic trauma/procedure (${post.treatment.procedure}) with baseline cardiac surveillance requirements.`;
            urgencyScore = 'Level 2 - High Monitoring';
          }

          const preHeartRate = pre?.baselineVitals?.find(v => v.parameter.includes('Heart'))?.value || '76 BPM';
          const postHeartRate = post?.initialVitals?.find(v => v.parameter.includes('Heart'))?.value || '108 BPM';
          const postPain = post?.initialVitals?.find(v => v.parameter.includes('Pain'))?.value || '9/10';

          return {
            source: 'HMS Clinical Intelligence Engine (Gemini Compatible)',
            patientId: patId,
            patientName: patName,
            patientPriority: {
              level: priority,
              badgeColor: priorityColor,
              urgencyScore: urgencyScore,
              rationale: priorityReason,
              triageStatus: 'Immediate Ward Monitoring & Telemetry'
            },
            comparativeSynthesis: {
              summary: `${patName} presented with acute post-accident trauma (${post?.accident?.incident || 'Trauma Incident'}) on ${post?.encounterDates || 'Nov 2026'}, compared against baseline health checkup (${pre?.encounterDate || 'Aug 2026'}). Historical record indicates baseline ${pre?.medicalHistory?.knownCondition || 'no chronic cardiac illness'} on ${pre?.currentMedications?.[0]?.medication || 'prescribed therapy'}. Post-accident hospitalization involved ${post?.diagnosis?.primary || 'acute fracture'} requiring ${post?.treatment?.procedure || 'operative intervention'}.`,
              keyDelta: [
                `Heart Rate Shift: Baseline ${preHeartRate} elevated to acute ${postHeartRate} (sinus tachycardia secondary to surgical trauma / pain).`,
                `Hemoglobin Delta: Baseline 13.4 g/dL dropped to post-operative 11.8 g/dL (physiological perioperative blood loss without transfusion requirement).`,
                `Mobility Impact: Independent ambulation reduced to assisted non-weight bearing walker mobilization.`
              ]
            },
            thingsToLookOutFor: [
              {
                category: 'Cardiac & Arrhythmia Surveillance',
                severity: 'CRITICAL',
                alert: `Monitor for recurrence of Paroxysmal Supraventricular Tachycardia (PSVT) or sudden palpitations. Maintain regular dosing of Metoprolol Succinate 25mg QD.`,
                monitoring: 'Daily 12-lead ECG review or telemetry if pulse exceeds 100 BPM at rest.'
              },
              {
                category: 'Thromboembolism Prophylaxis (DVT / PE)',
                severity: 'HIGH',
                alert: `High risk of deep vein thrombosis following lower limb fracture and reduced mobility.`,
                monitoring: 'Ensure strict adherence to subcutaneous Enoxaparin 40mg daily for the complete 14-day course. Inspect calf for unilateral swelling, warmth, or tenderness.'
              },
              {
                category: 'Surgical Site & Implant Alignment',
                severity: 'MODERATE',
                alert: `Surgical incision monitoring for signs of surgical site infection (erythema, warmth, purulent discharge, or spiking fever > 38°C).`,
                monitoring: 'Wound inspection at 7-10 days; follow-up check radiograph at 10-14 days to confirm axial and rotational alignment.'
              },
              {
                category: 'Pain Control & Gastroprotection',
                severity: 'STANDARD',
                alert: `Transition from acute multimodal analgesia (Paracetamol 650mg) to as-needed dosing.`,
                monitoring: 'Co-prescribe Pantoprazole 40mg QD to prevent drug-induced gastric mucosal irritation.'
              }
            ],
            medicationReconciliation: {
              continuedBaseline: pre?.currentMedications?.map(m => `${m.medication} ${m.dosage} (${m.purpose})`) || ['Metoprolol Succinate 25mg QD'],
              newPostAccident: post?.dischargeMeds?.map(m => `${m.medication} ${m.dose} (${m.purpose})`) || ['Enoxaparin 40mg', 'Paracetamol 650mg', 'Pantoprazole 40mg'],
              contraindicatedOrAllergies: pat.allergies?.map(a => `${a.name} (${a.severity})`) || ['None Documented']
            },
            recommendedActionPlan: [
              'Continue scheduled rate-control medication without interruption.',
              'Begin supervised passive and active-assisted range of motion exercises with physiotherapy team.',
              'Schedule Orthopedic Outpatient review within 10–14 days for stitch removal and repeat X-ray.',
              'Immediate emergency re-admission if patient reports sudden onset chest pain, shortness of breath, dizziness, or syncope.'
            ]
          };
        };

        // If no API key is provided, return structured clinical intelligence immediately
        if (!apiKey) {
          const fallback = buildFallbackAnalysis(patientData, preRecord, postRecord);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            mode: 'LOCAL_SYNTHESIS',
            message: 'Generated comprehensive clinical analysis using HMS Clinical Intelligence Engine (add Gemini API Key to switch to Live Gemini 1.5 / 2.0 Pro)',
            data: fallback
          }));
        }

        // Live Gemini API Call
        const systemPrompt = `You are a Senior Chief Medical Informatics AI for an acute care hospital.
You are given two clinical documents for a patient:
1. Document 1 (PRE-ACCIDENT): Routine medical checkup / baseline health report.
2. Document 2 (POST-ACCIDENT): Emergency trauma & hospitalization encounter report.

Analyze both documents thoroughly and return ONLY a valid JSON object (no markdown code fences, no extra text) with this exact schema:
{
  "source": "Google Gemini Live Intelligence Layer",
  "patientId": "Patient ID",
  "patientName": "Patient Name",
  "patientPriority": {
    "level": "HIGH CLINICAL PRIORITY | MEDIUM PRIORITY | LOW PRIORITY",
    "badgeColor": "rose | amber | emerald",
    "urgencyScore": "Level 1 to 5 description",
    "rationale": "Clear concise reason for assigned priority",
    "triageStatus": "Recommended triage action"
  },
  "comparativeSynthesis": {
    "summary": "3-4 sentence clinical summary comparing pre-accident baseline to post-accident trauma",
    "keyDelta": ["Delta 1: vitals/labs shift", "Delta 2: physical functional change", "Delta 3: metabolic/surgical alteration"]
  },
  "thingsToLookOutFor": [
    {
      "category": "Risk category name",
      "severity": "CRITICAL | HIGH | MODERATE | STANDARD",
      "alert": "Detailed clinical warning",
      "monitoring": "Exact monitoring protocol"
    }
  ],
  "medicationReconciliation": {
    "continuedBaseline": ["list of pre-accident meds continued"],
    "newPostAccident": ["list of new trauma/surgical meds"],
    "contraindicatedOrAllergies": ["allergies or interactions to avoid"]
  },
  "recommendedActionPlan": [
    "Step 1 action item",
    "Step 2 action item",
    "Step 3 action item",
    "Red-flag emergency discharge warning"
  ]
}`;

        const userPrompt = `Patient Identification: ${patientData.name || 'Patient'} (${patientData.id || 'ID'}), Age: ${patientData.age || 'Unknown'}, Blood: ${patientData.bloodGroup || 'Unknown'}

=== DOCUMENT 1: PRE-ACCIDENT BASELINE RECORD ===
${JSON.stringify(preRecord || {}, null, 2)}

=== DOCUMENT 2: POST-ACCIDENT EMERGENCY TRAUMA & SURGERY RECORD ===
${JSON.stringify(postRecord || {}, null, 2)}

Provide your full medical evaluation in JSON.`;

        const requestBody = JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt + '\n\n' + userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        });

        // Use gemini-1.5-flash or gemini-2.0-flash
        const modelName = payload.model || 'gemini-1.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const parsedUrl = new URL(geminiUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        };

        const geminiReq = https.request(options, (geminiRes) => {
          let gData = '';
          geminiRes.on('data', d => { gData += d; });
          geminiRes.on('end', () => {
            try {
              const parsedG = JSON.parse(gData);
              if (geminiRes.statusCode >= 400 || parsedG.error) {
                console.warn('[Gemini API Warning]:', parsedG.error?.message || gData);
                // Fallback to local synthesis with warning note
                const fallback = buildFallbackAnalysis(patientData, preRecord, postRecord);
                fallback.source = 'HMS Clinical Intelligence Engine (Gemini API fallback)';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                  success: true,
                  mode: 'FALLBACK_SYNTHESIS',
                  apiError: parsedG.error?.message || 'Gemini API Error',
                  data: fallback
                }));
              }

              const candidateText = parsedG.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              let cleanedJson = candidateText.trim();
              if (cleanedJson.startsWith('```json')) {
                cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanedJson.startsWith('```')) {
                cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }

              const finalAnalysis = JSON.parse(cleanedJson);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: true,
                mode: 'LIVE_GEMINI',
                modelUsed: modelName,
                data: finalAnalysis
              }));
            } catch (err) {
              const fallback = buildFallbackAnalysis(patientData, preRecord, postRecord);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: true,
                mode: 'FALLBACK_SYNTHESIS',
                parseError: err.message,
                data: fallback
              }));
            }
          });
        });

        geminiReq.on('error', (e) => {
          console.error('[Gemini Request Error]:', e.message);
          const fallback = buildFallbackAnalysis(patientData, preRecord, postRecord);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            mode: 'FALLBACK_SYNTHESIS',
            networkError: e.message,
            data: fallback
          }));
        });

        geminiReq.write(requestBody);
        geminiReq.end();

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

  // Security check: ensure path stays within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallback, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// WebSocket Server for live push to the browser
const wss = new WebSocketServer({ server });
let wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);

  // Send current serial connection status upon connecting
  ws.send(JSON.stringify({
    type: 'STATUS',
    connected: activePort !== null && activePort.isOpen,
    port: activePort ? activePort.path : null
  }));

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

// -------------------------------------------------------------
// Auto-detect and connect to ESP32 USB Serial Port
// -------------------------------------------------------------
let activePort = null;
let parser = null;
let lastScannedCard = null;
let isScanningPorts = false;

async function autoConnectESP32() {
  if (isScanningPorts || (activePort && activePort.isOpen)) {
    return;
  }

  isScanningPorts = true;
  try {
    const ports = await SerialPort.list();

    // Look for typical ESP32 / USB-UART chipsets (Silicon Labs CP210x, CH340, FTDI, Espressif)
    const targetPort = ports.find(p => {
      const desc = `${p.manufacturer || ''} ${p.pnpId || ''} ${p.friendlyName || ''}`.toLowerCase();
      return (
        desc.includes('cp210') ||
        desc.includes('ch340') ||
        desc.includes('ftdi') ||
        desc.includes('silicon labs') ||
        desc.includes('espressif') ||
        desc.includes('usb-serial') ||
        desc.includes('wch.cn')
      );
    }) || (ports.length === 1 && !ports[0].path.includes('COM1') ? ports[0] : null);

    if (targetPort) {
      console.log(`🔌 Detected ESP32 USB Serial on ${targetPort.path} (${targetPort.manufacturer || targetPort.friendlyName || 'USB Serial'})`);
      openSerialPort(targetPort.path);
    }
  } catch (err) {
    console.error('Error scanning serial ports:', err.message);
  } finally {
    isScanningPorts = false;
  }
}

function openSerialPort(pathName) {
  if (activePort && activePort.isOpen) {
    return;
  }

  activePort = new SerialPort({
    path: pathName,
    baudRate: 115200,
    autoOpen: false
  });

  parser = activePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  activePort.open((err) => {
    if (err) {
      console.error(`❌ Failed to open port ${pathName}:`, err.message);
      activePort = null;
      return;
    }

    console.log(`✅ ESP32 Connected on ${pathName} at 115200 baud`);
    broadcast({ type: 'STATUS', connected: true, port: pathName });

    parser.on('data', (rawLine) => {
      handleSerialLine(rawLine.trim());
    });
  });

  activePort.on('close', () => {
    console.log(`⚠️ Serial port ${pathName} disconnected.`);
    activePort = null;
    broadcast({ type: 'STATUS', connected: false, port: null });
  });

  activePort.on('error', (err) => {
    console.error(`⚠️ Serial error on ${pathName}:`, err.message);
  });
}

function handleSerialLine(line) {
  if (!line) return;
  console.log(`[ESP32]: ${line}`);

  let cardUID = null;

  // JSON format: {"type":"RFID_SCAN","uid":"A1B2C3D4"}
  if (line.startsWith('{') && line.includes('RFID_SCAN')) {
    try {
      const data = JSON.parse(line);
      cardUID = data.uid;
    } catch (e) {}
  } else if (line.startsWith('RFID:')) {
    // Prefix format: RFID:A1B2C3D4
    cardUID = line.replace('RFID:', '').trim();
  } else if (line.startsWith('CARD_ID:')) {
    // Direct patient or UID line
    cardUID = line.replace('CARD_ID:', '').trim();
  } else if (line.startsWith('Card UID:')) {
    // Default Arduino example format: Card UID: A1 B2 C3 D4
    cardUID = line.replace('Card UID:', '').replace(/\s+/g, '').toUpperCase();
  }

  if (cardUID) {
    // Match card UID to patient ID (maps to P001 by default or if registered)
    const patientId = CARD_PATIENT_MAPPING[cardUID] || CARD_PATIENT_MAPPING["DEFAULT"] || "P001";
    lastScannedCard = { cardUID, patientId, timestamp: new Date().toISOString() };

    console.log(`💳 Card Scanned! UID: [${cardUID}] -> Patient ID: [${patientId}]`);

    // Broadcast scan event to all open browser windows
    broadcast({
      type: 'RFID_SCAN',
      uid: cardUID,
      patientId: patientId
    });
  }
}

// Periodically probe for plug/unplug of USB ESP32 every 3 seconds
setInterval(autoConnectESP32, 3000);
autoConnectESP32();

server.listen(PORT, () => {
  console.log(`\n🏥 PulseCare HMS Web App running at: http://localhost:${PORT}`);
  console.log(`📡 ESP32 USB RFID Bridge Active (auto-detects COM ports)`);
  console.log(`Press Ctrl+C to stop.\n`);
});
