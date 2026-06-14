const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// DATABASE CONNECTION
// ============================================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
  .then(() => console.log('✅ GeoSafe Database Engine Connected Successfully.'))
  .catch(err => {
    console.error('❌ Database Connection Error:', err.message);
    process.exit(1);
  });

// ============================================
// DATABASE SCHEMAS
// ============================================
const CaseReportSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  caseTitle: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  type: { type: String, enum: ['murder', 'dark', 'no_facilities'], required: true },
  description: { type: String, required: true, trim: true },
  policeIntervention: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CaseReportSchema.index({ location: '2dsphere' });
CaseReportSchema.index({ type: 1 });
CaseReportSchema.index({ category: 1 });

const CaseReport = mongoose.model('CaseReport', CaseReportSchema);

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function validateCoordinatesArray(coordinates) {
  if (!Array.isArray(coordinates)) {
    return { valid: false, error: 'Coordinates must be an array' };
  }
  if (coordinates.length === 0) {
    return { valid: false, error: 'Coordinates array cannot be empty' };
  }
  for (let i = 0; i < coordinates.length; i++) {
    const [lat, lng] = coordinates[i];
    if (!isValidLatLng(lat, lng)) {
      return {
        valid: false,
        error: `Invalid coordinate at index ${i}: lat=${lat}, lng=${lng}`
      };
    }
  }
  return { valid: true };
}

function authenticateAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing admin key' });
  }
  next();
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/seed-compendium', authenticateAdmin, async (req, res) => {
  try {
    await CaseReport.deleteMany({});
    await CaseReport.create([
      {
        caseTitle: '1. Shamshabad Toll Plaza (The Disha Case)',
        category: 'Severe Assault & Rape',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4215, 17.2512] },
        description:
          'A 26-year-old veterinary doctor was targeted near the Tondupally toll plaza. Perpetrators intentionally deflated her scooter tyre, ambushed her, gang-raped her, and asphyxiated her.',
        policeIntervention:
          'Triggered massive nationwide structural reforms, forced-patrolling updates, and rapid incident response audits.'
      },
      {
        caseTitle: '2. Jubilee Hills Minor Gang Rape',
        category: 'Severe Assault & Rape',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4112, 17.4305] },
        description:
          'A 17-year-old minor girl was abducted and gang-raped in a moving luxury car. Vehicle windows were deliberately covered to obscure public view.',
        policeIntervention:
          'Juvenile Justice Board ruled that four of the minors would be tried as adults due to the heinous nature of the crime.'
      },
      {
        caseTitle: '3. Miyapur Late Night Transit Case',
        category: 'Severe Assault & Rape',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.3485, 17.4932] },
        description:
          'A young female software employee was targeted while taking a shared auto-rickshaw late at night. Driver diverted to isolated area where she was assaulted and robbed.',
        policeIntervention:
          'Cyberabad She Teams launched mandatory transit QR-code tracking and strict nocturnal police patrolling.'
      },
      {
        caseTitle: '4. Narsingi Outer Ring Road Stretch',
        category: 'Severe Assault & Rape',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3408, 17.3914] },
        description:
          'A 23-year-old management student was offered a lift by acquaintances who drove to isolated ORR stretch, locked doors, and sexually assaulted her.',
        policeIntervention:
          'Cyberabad Police tracked vehicle using toll gate FASTag logs and CCTV footage, resulting in immediate arrest.'
      },
      {
        caseTitle: '5. Balanagar Minor Rape Case',
        category: 'Severe Assault & Rape',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.4482, 17.4691] },
        description:
          'An 11-year-old girl was lured away with promise of sweets by local factory worker. Perpetrator took her to abandoned warehouse and assaulted her.',
        policeIntervention:
          'Case was put on fast-track, resulting in life imprisonment sentence within a year under POCSO Act.'
      },
      {
        caseTitle: '6. Begumpet Multi-Storey Building Assault',
        category: 'Severe Assault & Rape',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4734, 17.4412] },
        description:
          'A 25-year-old corporate employee was trapped in isolated corridor by security guard who sexually assaulted her.',
        policeIntervention:
          'Security agency penalized. All commercial complexes now required to verify security staff credentials.'
      },
      {
        caseTitle: '7. Malkajgiri Realtor Shooting',
        category: 'Stalking & Unsafety',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.5312, 17.4521] },
        description:
          'A 48-year-old real estate businessman shot his second wife. Suspected her fidelity and had purchased illegal pistol from Bihar.',
        policeIntervention:
          'Highlights fatal escalation of domestic tracking and illegal arms transit across states.'
      },
      {
        caseTitle: '8. Saroornagar Daylight Stalking Case',
        category: 'Stalking & Unsafety',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.5368, 17.3622] },
        description:
          'A 21-year-old college student murdered by rejected stalker in broad daylight. Assailant pursued her for months before confronting her publicly.',
        policeIntervention:
          'Led to demands for immediate fast-track court rulings for public assaults and stalking cases.'
      },
      {
        caseTitle: '9. Moinabad Serial Lure & Murder Case',
        category: 'Stalking & Unsafety',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2842, 17.3235] },
        description:
          'A couple lured elderly women lenders to isolated farmhouse under pretext of clearing debts and murdered them.',
        policeIntervention:
          'Couple had plotted to execute eight women lenders. Six surviving women reported the pattern to police.'
      },
      {
        caseTitle: '10. Nampally Digital Blackmail Case',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4674, 17.3911] },
        description:
          'A 30-year-old man systematically stalked woman despite law enforcement warnings. Sent threatening messages and blackmail threats.',
        policeIntervention:
          'Prosecuted and imprisoned by Nampally Special Judicial Magistrate Court under BNS and Police Act.'
      },
      {
        caseTitle: '11. Langer Houz Multi-Platform Cyber Case',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4312, 17.3945] },
        description:
          'Serial cyber-stalker targeted multiple women through Instagram, WhatsApp, and Telegram with explicit messages.',
        policeIntervention:
          'She Teams tracked digital footprints and perpetrator was convicted at Nampally court.'
      },
      {
        caseTitle: '12. Undercover Bus-Stop Security Expose',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4862, 17.3848] },
        description:
          'Senior female police official posed as stranded commuter at bus stop without security. Nearly 40 men approached with predatory intent.',
        policeIntervention:
          'Hidden backup teams detained multiple offenders within three-hour window. Major security wake-up call.'
      },
      {
        caseTitle: '13. Malakpet Inter-State Infant Trafficking',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.4981, 17.3754] },
        description:
          'Massive trafficking web across states. ASHA worker collaborated with lab technicians to procure infants from multiple states.',
        policeIntervention:
          'Rescued 10 infants and arrested 27 people, including 18 adoptive parents who bypassed legal channels.'
      },
      {
        caseTitle: '14. Lingampally Child Kidnapping Gang',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3182, 17.4812] },
        description:
          'Gang operated for four years abducting children under five from marginalized families in huts and railway stations.',
        policeIntervention:
          'Unraveled when 4-year-old went missing. Five arrested and six children rescued.'
      },
      {
        caseTitle: '15. Kondurg Agri-Farm Forced Labor Camp',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2124, 17.0621] },
        description:
          'AHTU raided agricultural processing company on Hyderabad outskirts. Rescued seven minor trafficked children from Jharkhand.',
        policeIntervention:
          'Children handed over to National Human Rights Commission for immediate rehabilitation.'
      },
      {
        caseTitle: '16. Secunderabad Railway Transit Interchange',
        category: 'Human Trafficking',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.5024, 17.4344] },
        description:
          'Inter-state crime ring kidnapping children from Gujarat and trafficking into Hyderabad through railway station.',
        policeIntervention:
          'Coordinated raid arrested 11 individuals. Children were being sold to local syndicates.'
      },
      {
        caseTitle: '17. Patancheruvu Infant Supply Case',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2612, 17.5241] },
        description:
          'Father in financial distress manipulated into selling newborn infants. Sub-plot of broader trafficking ring.'
        ,
        policeIntervention:
          'Successfully rescued newborns and four other abducted children. Biological father and facilitators booked.'
      },
      {
        caseTitle: '18. Gachibowli & Madhapur Safe-House Networks',
        category: 'Kidnapping & Exploitation',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.3452, 17.4415] },
        description:
          'Coordinated raids across financial hubs busted ring where women were kidnapped under false employment promises.',
        policeIntervention:
          'Operators used online portals. Rescued 16 women from prostitution.'
      },
      {
        caseTitle: '19. Madhapur & Jubilee Hills Salon Coercion Ring',
        category: 'Kidnapping & Exploitation',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3814, 17.4484] },
        description:
          'Fake wellness center advertisements for hospitality jobs. Northeast Indian women had documents confiscated.',
        policeIntervention:
          'Escaped victim tip-off led to raids. Rescued nine women, property owners booked under ITPA.'
      },
      {
        caseTitle: '20. Secunderabad Lodge Campus Abduction Case',
        category: 'Kidnapping & Exploitation',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4912, 17.4395] },
        description:
          '19-year-old abducted near college by group acting for rejected suitor. Drugged and taken to secluded lodge.',
        policeIntervention:
          'Family acted quickly. Cell tower triangulation located lodge within hours. Four men arrested, girl rescued.'
      }
    ]);

    res.json({
      message: 'Master Compendium Database loaded successfully with all 20 real Hyderabad cases!',
      count: 20,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/route-safety', async (req, res) => {
  try {
    const { coordinates } = req.body;

    const validation = validateCoordinatesArray(coordinates);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const buffer = parseInt(process.env.GEOSPATIAL_BUFFER_DISTANCE) || 800;
    let segments = [];
    let detectedHazards = new Map();

    // Find all hazards within buffer
    const allHazards = await CaseReport.find({
      location: {
        $geoWithin: {
          $centerSphere: [
            [coordinates[0][1], coordinates[0][0]],
            (buffer / 1000) / 6371
          ]
        }
      }
    });

    // Process each coordinate
    for (let i = 0; i < coordinates.length; i++) {
      const [lat, lng] = coordinates[i];
      let segmentColor = 'green';
      let incidentCount = 0;

      // Find hazards near this point
      const nearbyHazards = allHazards.filter(hazard => {
        const distance = getDistance(
          lat,
          lng,
          hazard.location.coordinates[1],
          hazard.location.coordinates[0]
        );
        return distance <= buffer;
      });

      incidentCount = nearbyHazards.length;

      // Determine color based on incident count
      if (incidentCount >= 6) {
        segmentColor = 'red';
      } else if (incidentCount >= 3) {
        segmentColor = 'yellow';
      } else {
        segmentColor = 'green';
      }

      // Add unique hazards
      nearbyHazards.forEach(hazard => {
        if (!detectedHazards.has(hazard._id.toString())) {
          detectedHazards.set(hazard._id.toString(), hazard);
        }
      });

      segments.push({ lat, lng, color: segmentColor, incidentCount });
    }

    res.json({
      segments,
      hazards: Array.from(detectedHazards.values()),
      metadata: {
        routeLength: coordinates.length,
        hazardsDetected: detectedHazards.size,
        bufferDistance: buffer,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Route safety error:', err);
    res.status(500).json({
      error: 'Spatial calculation failed',
      message: NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

app.get('/api/hazards', async (req, res) => {
  try {
    const { type, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (type && ['murder', 'dark', 'no_facilities'].includes(type)) {
      query.type = type;
    }

    const hazards = await CaseReport.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 });

    const total = await CaseReport.countDocuments(query);

    res.json({
      hazards,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total
      }
    });
  } catch (err) {
    console.error('Get hazards error:', err);
    res.status(500).json({ error: 'Failed to fetch hazards' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await CaseReport.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await CaseReport.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await CaseReport.countDocuments();

    res.json({
      total,
      byType: stats,
      byCategory: categoryStats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Production Safety Server running at http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
});

module.exports = app;
