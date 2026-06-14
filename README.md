# GeoSafe - Global Safety Navigation Matrix

## 🌍 Overview

GeoSafe is a safety-focused route navigation application designed for Hyderabad. It helps users identify safe routes by analyzing proximity to crime incidents and displaying real-time hazard zones on an interactive map.

## ✨ Features

- **Interactive Map**: Real-time visualization of safe and dangerous routes using Leaflet.js
- **Route Analysis**: Calculate optimal routes with safety metrics
- **Hazard Detection**: Identify crime hotspots and dangerous areas
- **Case Database**: Comprehensive compendium of real Hyderabad incident cases
- **Statistics**: View safety statistics by incident type and category
- **Geocoding**: Address search with OpenStreetMap
- **Rate Limiting**: Protected API endpoints with request throttling
- **Security**: Environment-based configuration, input validation, and authentication

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- MongoDB Atlas account or local MongoDB instance
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/naveer-code/geosafe.git
   cd geosafe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```
   MONGO_URI=your_mongodb_connection_string
   ADMIN_SECRET_KEY=your-secure-admin-key
   PORT=3000
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📋 API Documentation

### Seed Database (Admin Only)
```http
GET /api/seed-compendium
Headers: x-admin-key: your-admin-secret-key
```

Populates the database with 20 real Hyderabad crime cases.

### Calculate Route Safety
```http
POST /api/route-safety
Content-Type: application/json

{
  "coordinates": [
    [17.3850, 78.4860],
    [17.3860, 78.4870],
    ...
  ]
}
```

Returns route segments with safety colors and nearby hazards.

### Get All Hazards
```http
GET /api/hazards?type=murder&limit=10&skip=0
```

Retrieve hazard incidents with optional filtering.

### Get Statistics
```http
GET /api/stats
```

Fetch aggregated safety statistics.

### Health Check
```http
GET /api/health
```

Verify API availability.

## 🛡️ Security Features

- **Environment Variables**: All sensitive data stored in `.env` file
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive coordinate and data validation
- **CORS Protection**: Restricted to allowed origins
- **Helmet.js**: Security HTTP headers
- **Admin Authentication**: Secret key required for database operations
- **Error Handling**: Graceful error responses without exposing internals

## 📊 Database Schema

### CaseReport Model
```javascript
{
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  caseTitle: String,
  category: String,
  type: "murder" | "dark" | "no_facilities",
  description: String,
  policeIntervention: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 🗺️ Incident Types

- **💀 Murder**: Violent crime incidents (red on map)
- **🌑 Dark**: Low-surveillance areas (yellow on map)
- **⚠️ No Facilities**: Areas lacking support resources (yellow on map)

## 🔧 Development

### Project Structure
```
geosafe/
├── server.js           # Express server with API routes
├── public/
│   └── index.html      # Frontend application
├── package.json        # Dependencies and scripts
├── .env.example        # Environment template
└── README.md           # This file
```

### Available Scripts

```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Run tests
npm test
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `MONGO_URI` | MongoDB connection string | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost:3000 |
| `ADMIN_SECRET_KEY` | Admin authentication key | - |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 (15min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `GEOSPATIAL_BUFFER_DISTANCE` | Hazard detection radius (meters) | 800 |

## 🧪 Testing

```bash
# Run test suite
npm test

# Run with coverage
npm test -- --coverage
```

## 📦 Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **cors**: CORS middleware
- **helmet**: Security headers
- **morgan**: Request logging
- **express-rate-limit**: Rate limiting
- **dotenv**: Environment configuration
- **leaflet**: Frontend map library
- **leaflet-control-geocoder**: Address search

## 🚨 Important Notes

1. **Never commit `.env` files** containing sensitive data
2. **Use strong admin keys** in production
3. **Update MongoDB connection string** with your credentials
4. **Enable HTTPS** in production
5. **Restrict API access** with proper authentication
6. **Monitor rate limits** and adjust as needed

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions, please open a GitHub issue.

## ⚖️ Disclaimer

This application provides safety information based on historical incident data. While efforts are made to ensure accuracy, users should verify information through official police sources and exercise personal judgment when planning routes.

---

**Made with ❤️ for safer cities**
