# Requirements Document

## Introduction

The Lugogo Mall Parking Management System (PMS) is a software platform that manages vehicle entry and exit at the Lugogo Shopping Mall parking facility in Kampala, Uganda. When a vehicle arrives, an attendant captures the driver's telephone number and intended destination within the mall. The system automatically assigns the nearest available parking slot to that destination, displays the slot number, and opens the entry barrier. On exit, the system identifies the vehicle by number plate, opens the exit barrier, and releases the slot. A live parking map gives attendants a real-time view of slot occupancy across the facility.

---

## Glossary

- **PMS**: Parking Management System — the software platform described in this document.
- **Vehicle**: A motorised vehicle entering or exiting the parking facility.
- **Plate Number**: The vehicle registration number displayed on the vehicle's number plate.
- **Driver**: The person driving the vehicle entering or exiting the facility.
- **Attendant**: A mall employee who operates the entry point and assists drivers.
- **Slot**: A single designated parking space within the facility.
- **Destination**: A shop, service, or named zone within the mall that the driver intends to visit.
- **Session**: The period between a vehicle's confirmed entry and its exit.
- **Entry Barrier**: The physical gate at the entry point controlled by the PMS.
- **Exit Barrier**: The physical gate at the exit point controlled by the PMS.
- **Entry Camera**: The camera mounted at the entry point that captures the vehicle's Plate Number.
- **Exit Camera**: The camera mounted at the exit point that captures the vehicle's Plate Number.
- **Parking Map**: The visual display showing the occupancy status of all Slots in the facility.
- **Session History Log**: A chronological record of all completed and active Sessions, including entry and exit details.
- **Operator**: A mall management employee with elevated system privileges, able to access dashboards and administrative screens.
- **Elapsed Time**: The duration a vehicle has been parked, calculated from the Session start time to the current time.
- **Destination Zone**: A labelled area on the Parking Map indicating which Slots are nearest to a given Destination.
- **Out-of-Service Slot**: A Slot that has been administratively disabled and cannot be assigned to a Driver.
- **Operator Dashboard**: A management screen displaying aggregate statistics about current parking facility usage.
- **Base Map**: The real-world map layer (OpenStreetMap or Google Maps) showing the actual geography, roads, and building footprint of Lugogo Mall.
- **GPS Coordinates**: The latitude and longitude values that define the real-world position of a Slot, gate, or landmark on the Base Map.
- **Slot Marker**: A coloured icon displayed on the Parking Map at the GPS coordinates of a Slot, indicating its occupancy status.

---

## Requirements

### Requirement 1: Automatic Plate Capture at Entry

**User Story:** As an Attendant, I want the system to automatically read the vehicle's number plate when it arrives, so that I do not have to type it in manually.

#### Acceptance Criteria

1. WHEN a vehicle arrives at the entry point, THE Entry Camera SHALL capture the vehicle's Plate Number and transmit it to the PMS.
2. WHEN the Entry Camera successfully reads a Plate Number, THE PMS SHALL pre-populate the Plate Number field on the Attendant's entry screen.
3. IF the Entry Camera fails to read the Plate Number, THEN THE PMS SHALL alert the Attendant and allow the Attendant to enter the Plate Number manually before proceeding.
4. IF the Entry Camera does not transmit a plate read within 30 seconds of a vehicle being detected at the entry point, THE PMS SHALL treat the read as failed and alert the Attendant to enter the Plate Number manually.

---

### Requirement 2: Driver Details and Destination Selection

**User Story:** As an Attendant, I want to record the driver's telephone number and destination, so that the system can assign the most convenient parking slot.

#### Acceptance Criteria

1. THE PMS SHALL provide an entry form that requires the Attendant to enter the Driver's telephone number before a Slot can be assigned.
2. THE PMS SHALL validate that the Driver's telephone number is a valid Ugandan mobile number (beginning with +256 or 07 followed by 8 digits) before allowing the Attendant to proceed.
3. THE PMS SHALL present the Attendant with a list of Destinations (shops and zones within the mall) from which the Attendant selects the Driver's intended Destination.
4. WHEN the Attendant selects a Destination, THE PMS SHALL automatically identify the nearest available Slot to that Destination.
5. IF no Slot is available in the facility, THEN THE PMS SHALL display a "Parking Full" message and prevent the Attendant from proceeding with the assignment.

---

### Requirement 3: Slot Assignment and Confirmation

**User Story:** As an Attendant, I want to confirm the assigned slot with a single button click, so that the slot is reserved for the driver and the barrier opens.

#### Acceptance Criteria

1. WHEN the PMS identifies the nearest available Slot, THE PMS SHALL display the assigned Slot number to the Attendant before confirmation.
2. WHEN the Attendant clicks the confirm button, THE PMS SHALL mark the Slot as occupied and create a Session linking the Plate Number, Driver telephone number, Destination, and assigned Slot.
3. WHEN a Session is created, THE PMS SHALL open the Entry Barrier to allow the vehicle to enter.
4. WHEN a Session is created, THE PMS SHALL update the Parking Map to show the assigned Slot as occupied.

---

### Requirement 4: Slot Number Sharing with Driver

**User Story:** As an Attendant, I want to share the assigned slot number with the driver via WhatsApp or SMS, so that the driver knows exactly where to park.

#### Acceptance Criteria

1. WHEN a Session is created, THE PMS SHALL display options to send the assigned Slot number to the Driver via WhatsApp or SMS.
2. WHEN the Attendant selects the WhatsApp option, THE PMS SHALL send a WhatsApp message containing the assigned Slot number to the Driver's telephone number.
3. WHEN the Attendant selects the SMS option, THE PMS SHALL send an SMS containing the assigned Slot number to the Driver's telephone number.
4. IF the message fails to send, THEN THE PMS SHALL display an error notification to the Attendant and allow the Attendant to retry.

---

### Requirement 5: Vehicle Exit and Slot Release

**User Story:** As a Driver, I want to exit the facility without stopping at a barrier, so that I can leave quickly after my visit.

#### Acceptance Criteria

1. WHEN a vehicle arrives at the exit point, THE Exit Camera SHALL capture the vehicle's Plate Number and transmit it to the PMS.
2. WHEN the PMS receives a Plate Number from the Exit Camera, THE PMS SHALL look up the active Session associated with that Plate Number.
3. WHEN an active Session is found for the exiting vehicle, THE PMS SHALL open the Exit Barrier automatically.
4. WHEN the Exit Barrier opens, THE PMS SHALL close the Session and mark the associated Slot as available.
5. WHEN the Slot is marked as available, THE PMS SHALL update the Parking Map to show the Slot as available.
6. IF the Exit Camera fails to read the Plate Number, THEN THE PMS SHALL alert the Attendant and allow the Attendant to enter the Plate Number manually to trigger the exit flow.
7. IF no active Session is found for the Plate Number presented at the exit, THEN THE PMS SHALL alert the Attendant and keep the Exit Barrier closed.

---

### Requirement 6: Real-Time Parking Map on Real Geography

**User Story:** As an Attendant, I want a live visual map of the parking facility displayed on the actual Lugogo Mall satellite/street map, so that the slot positions match the real physical layout of the parking area.

#### Acceptance Criteria

1. THE PMS SHALL display the Parking Map using OpenStreetMap or Google Maps as the base layer, centred on the real GPS coordinates of Lugogo Shopping Mall, Kampala, Uganda (approximately 0.3282° N, 32.6037° E).
2. THE Parking Map SHALL display the real building footprint, surrounding roads (including Jinja Road), and entry/exit gate positions of Lugogo Mall as shown on the base map layer.
3. THE PMS SHALL overlay parking Slot Markers on top of the Base Map at GPS Coordinates configured by the Operator via the Slot Layout Management screen.
4. WHILE a Slot is occupied, THE PMS SHALL display that Slot's Slot Marker in red on the Parking Map.
5. WHILE a Slot is available, THE PMS SHALL display that Slot's Slot Marker in green on the Parking Map.
6. WHILE a Slot is Out-of-Service, THE PMS SHALL display that Slot's Slot Marker in grey on the Parking Map.
7. WHEN a Slot status changes, THE PMS SHALL update the Slot Marker colour on the Parking Map within 5 seconds of the change.
8. THE Parking Map SHALL reflect the current state of all Slots without requiring a manual page refresh.
9. THE Parking Map SHALL display labelled markers for the entry gate and exit gate at their real geographic positions on the Base Map.
10. THE Parking Map SHALL display labelled markers for key destinations within the mall (e.g. Carrefour supermarket, MTN store, food court, cinema, ATMs, banks) at their approximate real positions on the Base Map.

---

### Requirement 7: Session History Log

**User Story:** As an Attendant or Operator, I want to view and search a log of all vehicle sessions, so that I can look up past entries and exits for accountability and reference.

#### Acceptance Criteria

1. THE PMS SHALL maintain a Session History Log containing a record for every Session, including Plate Number, Driver telephone number, Destination, assigned Slot, entry time, and exit time.
2. THE PMS SHALL retain Session records for all current-day and past-day Sessions without automatic deletion.
3. WHEN an Attendant or Operator opens the Session History Log, THE PMS SHALL display all Session records in reverse chronological order by entry time.
4. WHEN an Attendant or Operator enters a search term in the Session History Log, THE PMS SHALL filter and display only the Session records whose Plate Number or Driver telephone number contains the search term.
5. WHILE a Session is still active (vehicle has not exited), THE PMS SHALL display the exit time field for that record as blank in the Session History Log.

---

### Requirement 8: Attendant Login

**User Story:** As a system administrator, I want Attendants to log in before using the system, so that every action is traceable to a specific Attendant for accountability.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the PMS, THE PMS SHALL display a login screen requiring a username and password before granting access.
2. WHEN an Attendant submits valid credentials, THE PMS SHALL authenticate the Attendant and grant access to the Attendant interface.
3. IF an Attendant submits invalid credentials, THEN THE PMS SHALL display an authentication error message and keep the Attendant on the login screen.
4. IF an Attendant submits invalid credentials 5 or more consecutive times, THE PMS SHALL lock that account for 15 minutes and display a lockout message.
5. WHEN a Session is created, THE PMS SHALL record the authenticated Attendant's identity against that Session record.
6. WHEN an Entry Barrier or Exit Barrier is opened, THE PMS SHALL record the authenticated Attendant's identity against that barrier action.
7. WHEN an Attendant logs out, THE PMS SHALL end the Attendant's authenticated session and redirect to the login screen.
8. User passwords SHALL be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one digit.

---

### Requirement 9: Parking Duration Display

**User Story:** As an Attendant, I want to see how long each vehicle has been parked directly on the parking map, so that I can quickly identify unusually long stays.

#### Acceptance Criteria

1. WHILE a Slot is occupied, THE PMS SHALL display the Elapsed Time for that Session on the Slot's representation on the Parking Map.
2. THE PMS SHALL update the Elapsed Time displayed on each occupied Slot at least once every minute.
3. THE PMS SHALL display Elapsed Time in hours and minutes format (e.g. 2h 15m).

---

### Requirement 10: Destination Zones on the Map

**User Story:** As an Attendant, I want the parking map to show which zones are closest to which destinations, so that I can guide drivers and understand slot assignments at a glance.

#### Acceptance Criteria

1. THE Parking Map SHALL visually group Slots into Destination Zones, where each Destination Zone corresponds to a Destination in the mall.
2. THE Parking Map SHALL display a label identifying the Destination associated with each Destination Zone.
3. WHEN a Destination is added, edited, or removed via the Destination Management screen, THE Parking Map SHALL update the Destination Zone labels to reflect the change within 5 seconds.

---

### Requirement 11: Slot Search

**User Story:** As an Attendant, I want to click on any slot on the parking map to see its details, so that I can quickly look up who is parked there.

#### Acceptance Criteria

1. WHEN an Attendant clicks on an occupied Slot on the Parking Map, THE PMS SHALL display a detail panel showing the Plate Number, Driver telephone number, Destination, and entry time for the active Session in that Slot.
2. WHEN an Attendant clicks on an available Slot on the Parking Map, THE PMS SHALL display a detail panel confirming that the Slot is available and showing the Slot identifier.
3. WHEN an Attendant clicks on an Out-of-Service Slot on the Parking Map, THE PMS SHALL display a detail panel indicating that the Slot is out of service.

---

### Requirement 12: Operator Dashboard

**User Story:** As an Operator, I want a management screen showing key parking statistics, so that I can monitor facility usage at a glance.

#### Acceptance Criteria

1. THE Operator Dashboard SHALL display the total number of Slots in the facility.
2. THE Operator Dashboard SHALL display the number of Slots currently occupied.
3. THE Operator Dashboard SHALL display the number of Slots currently available.
4. THE Operator Dashboard SHALL display the total number of vehicles that have entered the facility since midnight of the current day.
5. WHEN any Slot status changes, THE Operator Dashboard SHALL update all displayed statistics within 5 seconds of the change.

---

### Requirement 13: Destination Management

**User Story:** As an Operator, I want to add, edit, and remove destinations in the system, so that the destination list stays accurate as mall tenants change.

#### Acceptance Criteria

1. THE PMS SHALL provide a Destination Management screen accessible only to authenticated Operators.
2. WHEN an Operator submits a new Destination name on the Destination Management screen, THE PMS SHALL add the Destination to the list of selectable Destinations on the Attendant entry form.
3. WHEN an Operator edits an existing Destination name on the Destination Management screen, THE PMS SHALL update the Destination name across all screens and Session records that reference it.
4. WHEN an Operator removes a Destination on the Destination Management screen, THE PMS SHALL remove the Destination from the list of selectable Destinations on the Attendant entry form.
5. IF an Operator attempts to remove a Destination that is referenced by one or more active Sessions, THEN THE PMS SHALL display a warning and require the Operator to confirm before completing the removal.

---

### Requirement 14: Slot Layout Management

**User Story:** As an Operator, I want to mark individual slots as out of service, so that damaged or maintenance-affected slots are not assigned to drivers.

#### Acceptance Criteria

1. THE PMS SHALL provide a Slot Layout Management screen accessible only to authenticated Operators.
2. WHEN an Operator marks a Slot as out of service on the Slot Layout Management screen, THE PMS SHALL set that Slot's status to Out-of-Service and prevent the PMS from assigning that Slot to any Driver.
3. WHEN an Operator marks an Out-of-Service Slot as back in service on the Slot Layout Management screen, THE PMS SHALL restore that Slot to available status and allow the PMS to assign it to Drivers.
4. WHILE a Slot is Out-of-Service, THE Parking Map SHALL display that Slot in grey.
5. IF an Operator attempts to mark a Slot as out of service while that Slot has an active Session, THEN THE PMS SHALL display a warning and require the Operator to confirm before completing the action.

---

### Requirement 15: Full Parking Alert

**User Story:** As an Attendant, I want a prominent alert when all slots are occupied, so that I can redirect incoming drivers before they reach the barrier.

#### Acceptance Criteria

1. WHEN all Slots in the facility are occupied, THE PMS SHALL display a prominent "Parking Full" alert on the Attendant's main screen.
2. WHILE the "Parking Full" alert is active, THE PMS SHALL prevent the Attendant from initiating a new entry Session.
3. WHEN at least one Slot becomes available, THE PMS SHALL automatically dismiss the "Parking Full" alert and restore the Attendant's ability to initiate new entry Sessions.

---

### Requirement 16: Parking Slot GPS Configuration

**User Story:** As an Operator, I want to place parking slot markers on the real map by clicking their actual positions, so that the map accurately reflects the physical parking layout of Lugogo Mall.

#### Acceptance Criteria

1. THE Slot Layout Management screen SHALL display the same Base Map (OpenStreetMap or Google Maps) used by the Parking Map.
2. WHEN an Operator clicks a position on the Base Map in the Slot Layout Management screen, THE PMS SHALL create a new Slot Marker at the clicked GPS Coordinates and prompt the Operator to enter a Slot identifier (e.g. A1, B3).
3. WHEN an Operator saves a Slot's GPS Coordinates, THE PMS SHALL store the GPS Coordinates and display the Slot Marker at that position on both the Slot Layout Management screen and the live Parking Map.
4. WHEN an Operator drags an existing Slot Marker to a new position on the Slot Layout Management screen, THE PMS SHALL update the stored GPS Coordinates for that Slot.
5. THE PMS SHALL allow the Operator to place markers for entry gates, exit gates, and destination landmarks on the Base Map, each with a configurable label.
6. IF an Operator attempts to save a Slot at GPS Coordinates that are within 1 metre of an existing Slot's GPS Coordinates, THE PMS SHALL display a warning and require the Operator to confirm or reposition the Slot before saving.

---

### Requirement 17: Non-Functional Requirements

**User Story:** As a system administrator, I want the PMS to meet baseline performance, availability, and security standards, so that the system is reliable and safe for daily operations.

#### Acceptance Criteria

1. THE PMS SHALL remain available for normal operations at least 99% of the time during mall operating hours (06:00–22:00 EAT).
2. THE PMS SHALL support at least 10 concurrent authenticated users (Attendants and Operators) without degradation in response time.
3. ALL API responses for read operations SHALL complete within 2 seconds under normal load.
4. THE PMS SHALL store and compute all date and time values in East Africa Time (UTC+3), including the midnight boundary used for daily entry counts.
5. ALL communication between the browser client and the API server SHALL be encrypted using TLS (HTTPS and WSS).
6. THE PMS SHALL perform an environment variable validation check on startup and refuse to start if any required variable (MONGO_URI, JWT_SECRET, ANPR_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AT_API_KEY) is missing or empty.
7. THE PMS SHALL provide a database seed script that creates at least one default Operator account on first-time setup, so that the system can be accessed immediately after deployment.
