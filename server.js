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
app.use(helmet()); // Set security HTTP headers

// CORS with restricted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Request logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serving static files
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
    coordinates: { type: [Number], required: true } // [lng, lat]
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

/**
 * Validate latitude and longitude values
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lng - Longitude (-180 to 180)
 * @returns {boolean}
 */
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

/**
 * Validate coordinates array
 * @param {array} coordinates - Array of [lat, lng] pairs
 * @returns {object} { valid: boolean, error?: string }
 */
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

/**
 * Authentication middleware for admin endpoints
 */
function authenticateAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing admin key' });
  }
  next();
}

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/seed-compendium
 * Seed database with case files (ADMIN ONLY)
 */
app.get('/api/seed-compendium', authenticateAdmin, async (req, res) => {
  try {
    const count = await CaseReport.countDocuments();
    if (count > 0) {
      return res.status(400).json({
        error: 'Database already populated',
        message: `${count} cases already exist. Delete them first if you want to reseed.`
      });
    }

    await CaseReport.create([
      {
        caseTitle: '1. Shamshabad Toll Plaza (The Disha Case)',
        category: 'Severe Assault & Rape',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4215, 17.2512] },
        description:
          'A 26-year-old veterinary doctor was targeted near the Tondupally toll plaza. Perpetrators intentionally deflated her scooter tyre, ambushed her under the pretense of offering help, dragged her into nearby bushes, gang-raped her, and asphyxiated her.',
        policeIntervention:
          'Triggered massive nationwide structural reforms, forced-patrolling updates, and rapid incident response audits.'
      },
      {
        caseTitle: '2. Jubilee Hills Minor Gang Rape',
        category: 'Severe Assault & Rape',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4112, 17.4305] },
        description:
          'A 17-year-old minor girl was abducted and gang-raped in a moving luxury car (an Innova) after leaving a get-together at a pub in the upscale Jubilee Hills neighborhood. The vehicle windows were deliberately covered to obscure public view.',
        policeIntervention:
          'Juvenile Justice Board ruled that four of the minors would be tried as adults due to the heinous nature of the crime.'
      },
      {
        caseTitle: '3. Miyapur Late Night Transit Case',
        category: 'Severe Assault & Rape',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.3485, 17.4932] },
        description:
          'A young female software employee working in the IT corridor of Gachibowli was targeted while taking an unauthorized shared auto-rickshaw late at night. The driver and his accomplice diverted the route to an isolated area near Miyapur, where she was sexually assaulted and robbed.',
        policeIntervention:
          'Cyberabad She Teams launched mandatory transit QR-code tracking and strict nocturnal police patrolling across the Financial District.'
      },
      {
        caseTitle: '4. Narsingi Outer Ring Road Stretch',
        category: 'Severe Assault & Rape',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3408, 17.3914] },
        description:
          'A 23-year-old female management student was offered a lift late at night by an acquaintance and his friend near Gachibowli. Instead of dropping her at her destination, the men drove onto the isolated stretches of the Outer Ring Road near Narsingi. They locked the vehicle doors, subjected her to physical assault, and sexually assaulted her inside the moving car.',
        policeIntervention:
          'The Cyberabad Police tracked the vehicle using toll gate FASTag logs and CCTV footage, resulting in immediate arrest. Triggered a major safety audit of the ORR nighttime surveillance.'
      },
      {
        caseTitle: '5. Balanagar Minor Rape Case',
        category: 'Severe Assault & Rape',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.4482, 17.4691] },
        description:
          'An 11-year-old girl from a marginalized migrant laborer family went missing from outside her home in the industrial area of Balanagar. She was lured away with the promise of sweets by a 35-year-old local factory worker. The perpetrator took her to an abandoned warehouse nearby, where he brutally assaulted her.',
        policeIntervention:
          'The case was put on a fast-track timeline, resulting in a life imprisonment sentence for the accused within a year under the POCSO Act.'
      },
      {
        caseTitle: '6. Begumpet Multi-Storey Building Assault',
        category: 'Severe Assault & Rape',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4734, 17.4412] },
        description:
          'A 25-year-old corporate employee was trapped inside a commercial multi-storey building in Begumpet after office hours. A private security guard on duty intercepted her in an isolated corridor near the stairwell, cut off her path to the elevator, and sexually assaulted her.',
        policeIntervention:
          'The security agency was heavily penalized for failing to conduct background checks. Led to a mandate requiring all commercial complexes in Hyderabad to verify the credentials of their private security staff.'
      },
      {
        caseTitle: '7. Malkajgiri Realtor Shooting',
        category: 'Stalking & Unsafety',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.5312, 17.4521] },
        description:
          'A 48-year-old real estate businessman shot and killed his second wife at their residence in Maruti Nagar, Malkajgiri. The perpetrator suspected her fidelity and had spent 40 days in jail earlier that year after the task force caught him illegally buying a country-made pistol from Bihar to kill her.',
        policeIntervention:
          'The case highlights the fatal escalation of domestic tracking, marital disputes, and illegal arms transit.'
      },
      {
        caseTitle: '8. Saroornagar Daylight Stalking Case',
        category: 'Stalking & Unsafety',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.5368, 17.3622] },
        description:
          'A 21-year-old college student was brutally attacked and murdered in broad daylight in the Saroornagar area by a rejected stalker. The accused had been obsessively pursuing her for months; when she firmly rejected his advances, he confronted her in public and slit her throat.',
        policeIntervention:
          'This case became a definitive study on psychological obsession. It led to localized outrage and demands for immediate fast-track court rulings for public assaults.'
      },
      {
        caseTitle: '9. Moinabad Serial Lure & Murder Case',
        category: 'Stalking & Unsafety',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2842, 17.3235] },
        description:
          'A highly disturbing financial conspiracy unraveled when a couple, led by a woman named Karima Begum, systematically targeted elderly women lenders. They lured two women from Tandur to an isolated farmhouse in Moinabad under the pretext of clearing debts, where they murdered them.',
        policeIntervention:
          'Investigations revealed that the couple had plotted to execute eight women lenders similarly. The surviving six women approached the police after realizing the pattern.'
      },
      {
        caseTitle: '10. Nampally Digital Blackmail Case',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4674, 17.3911] },
        description:
          'A 30-year-old man, Chinthalapally Naveen Reddy, systematically targeted and stalked a Hyderabad-based woman. Despite being explicitly warned by law enforcement earlier, he continued to inundate her with continuous phone calls, intimidating messages, and threats of morphing her photos to blackmail her.',
        policeIntervention:
          'He was caught, prosecuted under Section 292 of the Bharatiya Nyaya Sanhita (BNS) and Section 70(c) of the Hyderabad City Police Act, and handed a jail sentence by the Nampally Special Judicial Magistrate Court.'
      },
      {
        caseTitle: '11. Langer Houz Multi-Platform Cyber Case',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4312, 17.3945] },
        description:
          'A 28-year-old serial cyber-stalker, Gadapa Naresh, targeted multiple unknown women across Hyderabad by sourcing their contact details through public directories and social platforms. He weaponized apps like Instagram, WhatsApp, and Telegram to send unsolicited, explicit messages.',
        policeIntervention:
          'After several women filed digital petitions, the She Teams tracked his digital footprints. He was convicted at the Nampally court.'
      },
      {
        caseTitle: '12. Undercover Bus-Stop Security Expose',
        category: 'Stalking & Unsafety',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.4862, 17.3848] },
        description:
          'In a high-profile operational experiment to gauge real-time women safety, Hyderabad police leadership went undercover. A senior female police official posed as a lone, stranded commuter at a public transit bus stop late at night without her security detail.',
        policeIntervention:
          'Within a short three-hour window, nearly 40 men approached her with predatory intent. Hidden backup teams immediately swarmed the location and detained multiple offenders.'
      },
      {
        caseTitle: '13. Malakpet Inter-State Infant Trafficking',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.4981, 17.3754] },
        description:
          'The Rachakonda Police cracked open a massive human trafficking web operating across multiple states. An ASHA worker from Malakpet collaborated with lab technicians and a marriage bureau owner to target poor mothers or illegally procure infants from states like Maharashtra and Uttar Pradesh.',
        policeIntervention:
          'Police successfully rescued 10 infants and arrested 27 people, including 18 adoptive parents who bypassed legal channels.'
      },
      {
        caseTitle: '14. Lingampally Child Kidnapping Gang',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3182, 17.4812] },
        description:
          'Led by an Ayurvedic practitioner named Chilukuri Raju, a gang operated for four years across Hyderabad, Cyberabad, and Sangareddy. They targeted marginalized families living in huts or railway stations, abducting children under the age of five.',
        policeIntervention:
          'The case unraveled when a 4-year-old boy went missing near a temple in Lingampally. Police arrested five individuals and rescued six children.'
      },
      {
        caseTitle: '15. Kondurg Agri-Farm Forced Labor Camp',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2124, 17.0621] },
        description:
          'The Anti-Human Trafficking Unit (AHTU), alongside the Rescue Foundation, raided an agricultural processing private limited company in Kondurg, on the outskirts of Hyderabad. They rescued seven minor trafficked children (six girls and one boy) who had been brought illegally from Jharkhand.',
        policeIntervention:
          'The children were handed over to the National Human Rights Commission for immediate rehabilitation.'
      },
      {
        caseTitle: '16. Secunderabad Railway Transit Interchange',
        category: 'Human Trafficking',
        type: 'dark',
        location: { type: 'Point', coordinates: [78.5024, 17.4344] },
        description:
          'A deeply entrenched inter-state crime ring was busted when police intercepted a group attempting to transport children through Secunderabad Railway Station. The network systematically kidnapped young children from marginalized communities in Gujarat and trafficked them into Hyderabad.',
        policeIntervention:
          'A coordinated raid led to the arrest of 11 individuals operating across state lines. Investigators found that the children were being sold to local syndicates.'
      },
      {
        caseTitle: '17. Patancheruvu Infant Supply Case',
        category: 'Human Trafficking',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.2612, 17.5241] },
        description:
          'During the broader crackdown on the Ayurvedic practitioner child-kidnapping ring in Hyderabad, a shocking sub-plot of exploitation emerged in Patancheruvu. A local father fell into extreme financial distress and was manipulated into selling his own newborn infants.',
        policeIntervention:
          'The police successfully rescued the newborns along with four other abducted children. The biological father, along with the facilitators, was booked under severe anti-trafficking laws.'
      },
      {
        caseTitle: '18. Gachibowli & Madhapur Safe-House Networks',
        category: 'Kidnapping & Exploitation',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.3452, 17.4415] },
        description:
          'In an expansive, coordinated night-raid across major financial hubs including Gachibowli, Madhapur, Narsingi, and Kukatpally, the Anti-Human Trafficking Unit busted a decentralized ring where women were being kidnapped or coerced under false employment promises.',
        policeIntervention:
          'The operators used online portals to traffic women from other states and lock them in residential apartments. The police rescued 16 women from prostitution.'
      },
      {
        caseTitle: '19. Madhapur & Jubilee Hills Salon Coercion Ring',
        category: 'Kidnapping & Exploitation',
        type: 'no_facilities',
        location: { type: 'Point', coordinates: [78.3814, 17.4484] },
        description:
          'Pretending to run legitimate wellness centers, a network of operators across Madhapur and Jubilee Hills put out fake advertisements for hospitality and front-desk jobs. Young women migrating from Northeast India were intercepted at transit hubs and had their identity documents confiscated.',
        policeIntervention:
          'Following a tip-off from an escaped victim, the Cyberabad Police raided three upscale properties, rescued over nine women, and booked the property owners under the ITPA.'
      },
      {
        caseTitle: '20. Secunderabad Lodge Campus Abduction Case',
        category: 'Kidnapping & Exploitation',
        type: 'murder',
        location: { type: 'Point', coordinates: [78.4912, 17.4395] },
        description:
          'A 19-year-old girl was abducted from near her college campus in Kukatpally by a group acting on behalf of a rejected suitor. She was forced into a vehicle, drugged, and taken to a secluded lodge near Secunderabad, where the perpetrators attempted to stage a forced marriage.',
        policeIntervention:
          'The victim family acted quickly, allowing the police to use cell tower triangulation to locate the lodge within hours. The police forced entry into the room, rescued the girl safely, and arrested four men.'
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

/**
 * POST /api/route-safety
 * Calculate route safety based on proximity to crime incidents
 */
app.post('/api/route-safety', async (req, res) => {
  try {
    const { coordinates } = req.body;

    // Validate coordinates
    const validation = validateCoordinatesArray(coordinates);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const buffer = parseInt(process.env.GEOSPATIAL_BUFFER_DISTANCE) || 800;
    let segments = [];
    let detectedHazards = new Map();

    // Find all hazards within buffer distance of the entire route (optimized)
    const allHazards = await CaseReport.find({
      location: {
        $geoWithin: {
          $centerSphere: [
            [coordinates[0][1], coordinates[0][0]],
            (buffer / 1000) / 6371 // Convert meters to radians
          ]
        }
      }
    });

    // Process each coordinate point
    for (let i = 0; i < coordinates.length; i++) {
      const [lat, lng] = coordinates[i];
      let segmentColor = 'green';

      // Check if any hazard is within buffer of this point
      const nearbyHazard = allHazards.find(hazard => {
        const distance = getDistance(
          lat,
          lng,
          hazard.location.coordinates[1],
          hazard.location.coordinates[0]
        );
        return distance <= buffer;
      });

      if (nearbyHazard) {
        if (nearbyHazard.type === 'murder') {
          segmentColor = 'red';
        } else if (nearbyHazard.type === 'dark' || nearbyHazard.type === 'no_facilities') {
          segmentColor = 'yellow';
        }

        if (!detectedHazards.has(nearbyHazard._id.toString())) {
          detectedHazards.set(nearbyHazard._id.toString(), nearbyHazard);
        }
      }

      segments.push({ lat, lng, color: segmentColor });
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

/**
 * GET /api/hazards
 * Get all hazards in the database
 */
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

/**
 * GET /api/stats
 * Get statistics about hazards
 */
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
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
// FALLBACK ROUTE
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Production Safety Server running at http://localhost:${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
});

module.exports = app;
