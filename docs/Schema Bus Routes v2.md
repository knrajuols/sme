// ==========================================
// 1. TRANSPORT STAFF
// ==========================================

model Driver {
  id                       String    @id @default(uuid())
  tenantId                 String
  name                     String    
  mobile                   String    
  licenseNumber            String    
  licenseExpiry            DateTime  
  badgeNumber              String?   
  badgeExpiry              DateTime? 
  policeVerificationStatus String?   // e.g., "Verified", "Pending"
  isActive                 Boolean   @default(true) 
  deletedAt                DateTime? 

  // STRICT ASSIGNMENT: Drivers only exist on Trips now.
  trips                    RouteTrip[]

  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([tenantId])
}

model Attendant {
  id                       String    @id @default(uuid())
  tenantId                 String
  name                     String    
  mobile                   String    
  policeVerificationStatus String?   
  isActive                 Boolean   @default(true) 
  deletedAt                DateTime? 

  // STRICT ASSIGNMENT: Attendants only exist on Trips now.
  trips                    RouteTrip[]

  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([tenantId])
}

// ==========================================
// 2. FLEET MANAGEMENT (VEHICLES)
// ==========================================

model Vehicle {
  id                        String    @id @default(uuid())
  tenantId                  String
  registrationNo            String    // e.g., TS-07-UA-1234
  vehicleType               String    // e.g., Bus, Minivan, Winger
  capacity                  Int       // Total physical seats
  
  // NOTE: driverId and attendantId have been completely removed.
  // Vehicles are just metal. Staff are assigned at the RouteTrip level.

  // Compliance & Legal 
  fitnessCertificateNo      String?   
  fitnessExpiryDate         DateTime? 
  insurancePolicyNo         String?   
  insuranceExpiryDate       DateTime? 
  pucCertificateNo          String?   
  pucExpiryDate             DateTime? 
  permitNo                  String?   
  permitExpiryDate          DateTime? 

  // Maintenance & Safety
  lastServiceDate           DateTime? 
  nextServiceDue            DateTime? 
  odometerReading           Int?      
  gpsDeviceId               String?   
  cctvInstalled             Boolean   @default(false) 
  fireExtinguisherAvailable Boolean   @default(false) 
  firstAidAvailable         Boolean   @default(false) 

  isActive                  Boolean   @default(true) 
  deletedAt                 DateTime? 

  // Operational mapping
  trips                     RouteTrip[]

  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt

  @@unique([tenantId, registrationNo])
  @@index([tenantId])
}