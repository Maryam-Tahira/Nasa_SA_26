# Nasa_SA_26
live link: https://maryam-tahira.github.io/Nasa_SA_26/

# AstroQuest — Junior Astronaut Mission Trainer

A web-based space learning platform built for NASA Space Apps Challenge 2026 by Team Astro_W1 from International Islamic University Chittagong (IIUC), Bangladesh. AstroQuest turns real NASA data into an interactive mission simulator for young learners — explore planets in 3D, build rockets, launch missions, run a Moon base, and see live feeds from NASA.
 What we built

# Full backend version (complete, in this repo):

ASP.NET Core MVC + SQL Server + Identity authentication
REST API with 25+ endpoints (planets, cosmic objects, quiz, rocket launches, mission scoring, leaderboard, NASA proxy, AI chatbot)
Server-side validation for every game action (XP, badges, rocket builds, quiz grading) so nothing can be faked from the browser
Admin panel for managing users and quiz questions
NASA API key kept server-side (never exposed to browser)
Anthropic Claude integration for the “Ask Astro” AI guide

# Frontend-only build (shown in the demo):

Because we didn’t have hosting for the backend, we built a separate frontend-only version that runs entirely in the browser
mock-api.js intercepts fetch('/api/...') calls and runs the same backend rules in the browser
Uses localStorage for accounts, scores, and progress
Can be opened directly from a single HTML file — no server, no install
Every feature of the real app works: register/login, rocket launches, quiz, leaderboard, admin panel, 3D scenes, NASA live data


# Features:
3D Solar System & Deep Space (three.js) — planets, moons, black holes, pulsars
Rocket Lab — build rockets from 8 components, launch to 9 destinations
Landing experience — rotating 3D planet, astronaut animation, success/fail outcomes
Mission Budget Planner — real spaceflight economics
NASA Live — APOD, near-Earth asteroids, Mars rover, ISS tracker, EONET world map
Space Quiz — 5 topics, 50 server-graded questions
Astro the Alien — AI chatbot on every page
Gamification — XP, ranks (Cadet → Pilot → Commander), 5 badges, leaderboard
Accounts + admin panel


 # Datasets used
NASA Planetary Fact Sheet — all planet statistics
NASA Open APIs (api.nasa.gov) — APOD, NeoWs, Mars Rover Photos, Image Library
NASA EONET — live natural events world map
ISS Position API — real-time space station tracking
Reference links to LRO, Cassini, Magellan, Voyager (PDS), SDO, Parker Solar Probe, and more

Tech stack

ASP.NET Core · SQL Server · Identity · three.js · Leaflet · vanilla JS/HTML/CSS · Anthropic Claude API · NASA Open APIs

# Credits

Built by Team Astro_W1 — IIUC, Chittagong, Bangladesh:

Maryam Tahira — frontend & design, video 
Arpita Barua — backend (ASP.NET Core + SQL Server API)
Afia Ibnat - Resource find

Development assisted by Claude (Anthropic) — used for backend code scaffolding, frontend-only build conversion, and documentation.

Data from NASA (public domain).

# Note about the demo------>

Due to hosting constraints during the hackathon, we were unable to host the ASP.NET backend online, so what you see in the live demo is the standalone frontend-only build — the full backend code (API, database, authentication) is included in this repository and can be run locally with dotnet run.
