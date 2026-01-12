OfficeOrbit 🪐

OfficeOrbit is a modern, hybrid-work orchestration platform designed to bridge the gap between remote flexibility and office presence. Built with a focus on automation, it uses geofencing to seamlessly track Work-from-Office (WFO) compliance and provide real-time hybrid-mode analytics.

🚀 Overview
The shift to hybrid work created a data gap: "Who is in, when, and are we meeting our presence thresholds?" OfficeOrbit solves this by automating the attendance flow via mobile geofencing and visualizing the data through an enterprise-grade dashboard.

Key Features
📍 Automated Presence: Passive geofencing detects office entry/exit without manual "punch-ins."

📊 Hybrid Analytics: Real-time calculation of WFO percentages and minimum presence thresholds.

🛡️ Privacy-First: Stores boolean presence status and timestamps; no raw GPS coordinates are ever persisted.

📅 Workation Handling: Integrated leave and "work-from-anywhere" logic to adjust compliance targets dynamically.

🛠️ Tech Stack
This project uses a high-velocity, solo-developer optimized stack:

Mobile (FE): React Native + Expo (Cross-platform Geofencing)

Dashboard (FE): React + Vite (High-performance analytics)

Backend & DB: Supabase (PostgreSQL, Auth, and Edge Functions)

Language: TypeScript (Full-stack type safety)