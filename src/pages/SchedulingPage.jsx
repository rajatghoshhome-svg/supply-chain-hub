import { useState, useEffect, useCallback } from 'react';
import { T } from '../styles/tokens';
import ModuleLayout from '../components/shared/ModuleLayout';
import PageHeader from '../components/shared/PageHeader';
import GanttChartTab from '../components/scheduling/GanttChartTab';
import ShopFloorTab from '../components/scheduling/ShopFloorTab';
import SetupTab from '../components/scheduling/SetupTab';

const TABS = [
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'shopfloor', label: 'Shop Floor' },
  { id: 'setup', label: 'Setup' },
];

const API = '/api/scheduling/champion';

const PLANTS = [
  { code: 'PLT-DOGSTAR', name: 'DogStar Kitchens' },
  { code: 'PLT-NORTHSTAR', name: 'NorthStar Kitchen' },
];

/* ─── Static fallback data ─────────────────────────────────────────────────── *
 * Horizon: April 6–27 (504 hours). 16h production days (06:00–22:00).
 * "NOW" = April 9 14:30 → hour 80.5 from horizon start.
 * Orders before NOW are complete/running; after NOW are planned.
 * Each order is 6–14 hours (realistic pet food batch sizes).
 * ─────────────────────────────────────────────────────────────────────────── */
const FALLBACK = {
  plantCode: 'PLT-DOGSTAR',
  plantName: 'DogStar Kitchens',
  horizonStart: '2026-04-06',
  horizonEnd: '2026-04-27',
  nowTime: '2026-04-09T14:30:00Z',
  hoursPerDay: 16,
  lastGenerated: '2026-04-09T08:00:00Z',
  stages: [
    {
      name: 'Extrusion',
      workCenters: [
        {
          code: 'WC-DS-EXT1', name: 'Extruder 1', utilization: 0.85,
          orders: [
            // Day 1 (Mon 4/6): hrs 0–16
            { id: 'PO-DS-001', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog 25lb', brandColor: '#C8102E', qty: 2400, startTime: 0, endTime: 12, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-002', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog 25lb', brandColor: '#00563F', qty: 800, startTime: 13, endTime: 16, status: 'complete', pacePercent: 100, changeover: 1.0 },
            // Day 2 (Tue 4/7): hrs 24–40
            { id: 'PO-DS-003', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Prairie Dog', brandColor: '#00563F', qty: 1800, startTime: 24, endTime: 34, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-004', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Cat & Kitten Dry', brandColor: '#C8102E', qty: 1200, startTime: 35, endTime: 40, status: 'complete', pacePercent: 100, changeover: 1.0 },
            // Day 3 (Wed 4/8): hrs 48–64
            { id: 'PO-DS-005', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Six Fish Dog', brandColor: '#C8102E', qty: 2000, startTime: 48, endTime: 58, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-006', familyId: 'ACA-CAT-DRY', familyName: 'Acana Indoor Cat', brandColor: '#00563F', qty: 1100, startTime: 59, endTime: 64, status: 'complete', pacePercent: 100, changeover: 1.0 },
            // Day 4 (Thu 4/9 — today): hrs 72–88
            { id: 'PO-DS-007', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dog', brandColor: '#C8102E', qty: 1600, startTime: 72, endTime: 82, status: 'running', pacePercent: 78, changeover: 0.5 },
            { id: 'PO-DS-008', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog', brandColor: '#00563F', qty: 1200, startTime: 83, endTime: 88, status: 'planned', pacePercent: 0, changeover: 1.0 },
            // Day 5 (Fri 4/10): hrs 96–112
            { id: 'PO-DS-009', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Dog', brandColor: '#C8102E', qty: 900, startTime: 96, endTime: 104, status: 'planned', pacePercent: 0, changeover: 1.5 },
            { id: 'PO-DS-010', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Amazing Grains', brandColor: '#C8102E', qty: 1400, startTime: 106, endTime: 112, status: 'planned', pacePercent: 0, changeover: 1.5 },
            // Week 2: Mon 4/13 hrs 168–, Tue 184–, Wed 200–
            { id: 'PO-DS-041', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog 25lb', brandColor: '#00563F', qty: 2200, startTime: 168, endTime: 180, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-042', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Regional Red Dog', brandColor: '#C8102E', qty: 1800, startTime: 181, endTime: 192, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-043', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Tundra Cat Dry', brandColor: '#C8102E', qty: 1400, startTime: 200, endTime: 210, status: 'planned', pacePercent: 0, changeover: 0.5 },
            // Week 3: Mon 4/20 hrs 336–
            { id: 'PO-DS-044', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog 13lb', brandColor: '#00563F', qty: 2000, startTime: 336, endTime: 348, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-045', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Fit & Trim Dog', brandColor: '#C8102E', qty: 1600, startTime: 349, endTime: 360, status: 'planned', pacePercent: 0, changeover: 1.0 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-EXT2', name: 'Extruder 2', utilization: 0.79,
          orders: [
            { id: 'PO-DS-011', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog', brandColor: '#00563F', qty: 2600, startTime: 0, endTime: 14, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-012', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Regional Red Dog', brandColor: '#C8102E', qty: 1800, startTime: 24, endTime: 35, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-013', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Tundra Cat Dry', brandColor: '#C8102E', qty: 1500, startTime: 36, endTime: 40, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-014', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog', brandColor: '#00563F', qty: 2200, startTime: 48, endTime: 60, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-015', familyId: 'ORI-TREAT', familyName: 'Orijen FD Treats', brandColor: '#C8102E', qty: 600, startTime: 61, endTime: 64, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-016', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog 13lb', brandColor: '#C8102E', qty: 1400, startTime: 72, endTime: 80, status: 'running', pacePercent: 62, changeover: 1.0 },
            { id: 'PO-DS-017', familyId: 'ACA-CAT-DRY', familyName: 'Acana Grasslands Cat', brandColor: '#00563F', qty: 1000, startTime: 81, endTime: 88, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-018', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Cat', brandColor: '#C8102E', qty: 800, startTime: 96, endTime: 104, status: 'planned', pacePercent: 0, changeover: 1.5 },
            { id: 'PO-DS-046', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Coast Dog', brandColor: '#00563F', qty: 1900, startTime: 168, endTime: 179, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-047', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dog 25lb', brandColor: '#C8102E', qty: 1500, startTime: 192, endTime: 202, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-048', familyId: 'ACA-CAT-DRY', familyName: 'Acana Pacifica Cat', brandColor: '#00563F', qty: 1100, startTime: 336, endTime: 344, status: 'planned', pacePercent: 0, changeover: 0 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-EXT3', name: 'Extruder 3', utilization: 0.72,
          orders: [
            { id: 'PO-DS-019', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Dog', brandColor: '#C8102E', qty: 900, startTime: 0, endTime: 10, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-020', familyId: 'ACA-CAT-DRY', familyName: 'Acana Grasslands Cat', brandColor: '#00563F', qty: 1200, startTime: 11, endTime: 16, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-021', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Fit & Trim Dog', brandColor: '#C8102E', qty: 1600, startTime: 24, endTime: 34, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-022', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Coast Dog', brandColor: '#00563F', qty: 1400, startTime: 35, endTime: 40, status: 'complete', pacePercent: 100, changeover: 1.0 },
            // Skip day 3 — CIP downtime
            { id: 'PO-DS-023', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Amazing Grains', brandColor: '#C8102E', qty: 2000, startTime: 72, endTime: 82, status: 'delayed', pacePercent: 45, changeover: 0 },
            { id: 'PO-DS-024', familyId: 'ACA-DOG-DRY', familyName: 'Acana Singles Dog', brandColor: '#00563F', qty: 1100, startTime: 83, endTime: 88, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-049', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Cat & Kitten', brandColor: '#C8102E', qty: 1300, startTime: 96, endTime: 106, status: 'planned', pacePercent: 0, changeover: 0.5 },
            { id: 'PO-DS-050', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog', brandColor: '#00563F', qty: 1800, startTime: 168, endTime: 180, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-051', familyId: 'ORI-FD', familyName: 'Orijen FD Dog 16oz', brandColor: '#C8102E', qty: 700, startTime: 200, endTime: 208, status: 'planned', pacePercent: 0, changeover: 1.5 },
          ],
          downtimeBlocks: [
            { startTime: 48, endTime: 64, type: 'CIP', reason: 'CIP' },
          ],
        },
        {
          code: 'WC-DS-EXT4', name: 'Extruder 4', utilization: 0.68,
          orders: [
            { id: 'PO-DS-025', familyId: 'ACA-CAT-DRY', familyName: 'Acana Pacifica Cat', brandColor: '#00563F', qty: 1200, startTime: 0, endTime: 10, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-026', familyId: 'ORI-TREAT', familyName: 'Orijen Biscuit Treats', brandColor: '#C8102E', qty: 600, startTime: 11, endTime: 16, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-027', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Cat', brandColor: '#C8102E', qty: 800, startTime: 24, endTime: 32, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-028', familyId: 'ACA-DOG-DRY', familyName: 'Acana Singles Dog Dry', brandColor: '#00563F', qty: 1400, startTime: 33, endTime: 40, status: 'complete', pacePercent: 100, changeover: 1.0 },
            // Skip day 3 — CIP downtime
            { id: 'PO-DS-029', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Six Fish Dog', brandColor: '#C8102E', qty: 1800, startTime: 72, endTime: 83, status: 'delayed', pacePercent: 30, changeover: 0 },
            { id: 'PO-DS-030', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog', brandColor: '#00563F', qty: 1000, startTime: 84, endTime: 88, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-052', familyId: 'ORI-TREAT', familyName: 'Orijen FD Treats', brandColor: '#C8102E', qty: 500, startTime: 96, endTime: 102, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-053', familyId: 'ACA-CAT-DRY', familyName: 'Acana Indoor Cat', brandColor: '#00563F', qty: 1300, startTime: 168, endTime: 178, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-054', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dog 13lb', brandColor: '#C8102E', qty: 1500, startTime: 192, endTime: 202, status: 'planned', pacePercent: 0, changeover: 1.0 },
          ],
          downtimeBlocks: [
            { startTime: 48, endTime: 64, type: 'CIP', reason: 'CIP' },
          ],
        },
      ],
    },
    {
      name: 'Packaging',
      workCenters: [
        {
          code: 'WC-DS-PKG1', name: 'Pkg Line 1', utilization: 0.81,
          orders: [
            { id: 'PO-DS-031', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog 25lb', brandColor: '#C8102E', qty: 2400, startTime: 14, endTime: 22, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-032', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Prairie Dog 25lb', brandColor: '#00563F', qty: 1800, startTime: 36, endTime: 44, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-033', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Six Fish Dog 25lb', brandColor: '#C8102E', qty: 2000, startTime: 60, endTime: 68, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-034', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dog 25lb', brandColor: '#C8102E', qty: 1600, startTime: 84, endTime: 92, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-055', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog 25lb', brandColor: '#00563F', qty: 2200, startTime: 182, endTime: 192, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-056', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Regional Red 25lb', brandColor: '#C8102E', qty: 1800, startTime: 194, endTime: 204, status: 'planned', pacePercent: 0, changeover: 1.0 },
            { id: 'PO-DS-057', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog 25lb', brandColor: '#00563F', qty: 2000, startTime: 350, endTime: 360, status: 'planned', pacePercent: 0, changeover: 0 },
          ],
          downtimeBlocks: [],
        },
        {
          code: 'WC-DS-PKG2', name: 'Pkg Line 2', utilization: 0.76,
          orders: [
            { id: 'PO-DS-035', familyId: 'ACA-DOG-DRY', familyName: 'Acana Heritage Dog 13lb', brandColor: '#00563F', qty: 800, startTime: 18, endTime: 24, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-036', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Cat & Kitten 12lb', brandColor: '#C8102E', qty: 1200, startTime: 42, endTime: 48, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-037', familyId: 'ACA-DOG-DRY', familyName: 'Acana Red Meat Dog 25lb', brandColor: '#00563F', qty: 2600, startTime: 62, endTime: 74, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-038', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Original Dog 13lb', brandColor: '#C8102E', qty: 1400, startTime: 82, endTime: 90, status: 'running', pacePercent: 55, changeover: 1.0 },
            { id: 'PO-DS-058', familyId: 'ACA-DOG-DRY', familyName: 'Acana Wild Coast Dog 25lb', brandColor: '#00563F', qty: 1900, startTime: 180, endTime: 190, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-059', familyId: 'ORI-CAT-DRY', familyName: 'Orijen Tundra Cat 12lb', brandColor: '#C8102E', qty: 1400, startTime: 212, endTime: 220, status: 'planned', pacePercent: 0, changeover: 0.5 },
          ],
          downtimeBlocks: [
            { startTime: 120, endTime: 128, type: 'Maintenance', reason: 'MAINT' },
          ],
        },
        {
          code: 'WC-DS-PKG3', name: 'Pkg Line 3', utilization: 0.74,
          orders: [
            { id: 'PO-DS-039', familyId: 'ACA-CAT-DRY', familyName: 'Acana Indoor Cat 12lb', brandColor: '#00563F', qty: 1200, startTime: 12, endTime: 20, status: 'complete', pacePercent: 100, changeover: 0 },
            { id: 'PO-DS-040', familyId: 'ORI-FD', familyName: 'Orijen Freeze-Dried Dog 16oz', brandColor: '#C8102E', qty: 900, startTime: 24, endTime: 32, status: 'complete', pacePercent: 100, changeover: 0.5 },
            { id: 'PO-DS-060', familyId: 'ORI-TREAT', familyName: 'Orijen FD Treats 3.5oz', brandColor: '#C8102E', qty: 600, startTime: 66, endTime: 72, status: 'complete', pacePercent: 100, changeover: 1.0 },
            { id: 'PO-DS-061', familyId: 'ACA-DOG-DRY', familyName: 'Acana Prairie Dog 13lb', brandColor: '#00563F', qty: 2200, startTime: 73, endTime: 84, status: 'running', pacePercent: 88, changeover: 0.5 },
            { id: 'PO-DS-062', familyId: 'ORI-FD', familyName: 'Orijen FD Cat 16oz', brandColor: '#C8102E', qty: 800, startTime: 98, endTime: 106, status: 'planned', pacePercent: 0, changeover: 1.5 },
            { id: 'PO-DS-063', familyId: 'ACA-CAT-DRY', familyName: 'Acana Pacifica Cat 12lb', brandColor: '#00563F', qty: 1100, startTime: 170, endTime: 178, status: 'planned', pacePercent: 0, changeover: 0 },
            { id: 'PO-DS-064', familyId: 'ORI-DOG-DRY', familyName: 'Orijen Puppy Dog 13lb', brandColor: '#C8102E', qty: 1500, startTime: 204, endTime: 214, status: 'planned', pacePercent: 0, changeover: 1.0 },
          ],
          downtimeBlocks: [],
        },
      ],
    },
  ],
  summary: {
    totalOrders: 64,
    runningOrders: 4,
    completedOrders: 24,
    delayedOrders: 2,
    avgUtilization: 78,
    totalChangeoverHours: 8.5,
  },
  changeoverMatrix: {
    'ORI-DOG-DRY|ACA-DOG-DRY': 1.0, 'ORI-DOG-DRY|ORI-CAT-DRY': 0.5, 'ORI-DOG-DRY|ORI-FD': 1.5, 'ORI-DOG-DRY|ORI-TREAT': 1.0, 'ORI-DOG-DRY|ACA-CAT-DRY': 1.0,
    'ACA-DOG-DRY|ORI-DOG-DRY': 1.0, 'ACA-DOG-DRY|ORI-CAT-DRY': 1.0, 'ACA-DOG-DRY|ORI-FD': 1.5, 'ACA-DOG-DRY|ORI-TREAT': 1.0, 'ACA-DOG-DRY|ACA-CAT-DRY': 0.5,
    'ORI-CAT-DRY|ORI-DOG-DRY': 0.5, 'ORI-CAT-DRY|ACA-DOG-DRY': 1.0, 'ORI-CAT-DRY|ORI-FD': 1.0, 'ORI-CAT-DRY|ORI-TREAT': 0.5, 'ORI-CAT-DRY|ACA-CAT-DRY': 0.5,
    'ORI-FD|ORI-DOG-DRY': 1.5, 'ORI-FD|ACA-DOG-DRY': 1.5, 'ORI-FD|ORI-CAT-DRY': 1.0, 'ORI-FD|ORI-TREAT': 0.5, 'ORI-FD|ACA-CAT-DRY': 1.0,
    'ORI-TREAT|ORI-DOG-DRY': 1.0, 'ORI-TREAT|ACA-DOG-DRY': 1.0, 'ORI-TREAT|ORI-CAT-DRY': 0.5, 'ORI-TREAT|ORI-FD': 0.5, 'ORI-TREAT|ACA-CAT-DRY': 0.5,
    'ACA-CAT-DRY|ORI-DOG-DRY': 1.0, 'ACA-CAT-DRY|ACA-DOG-DRY': 0.5, 'ACA-CAT-DRY|ORI-CAT-DRY': 0.5, 'ACA-CAT-DRY|ORI-FD': 1.0, 'ACA-CAT-DRY|ORI-TREAT': 0.5,
  },
  downtimeEvents: [
    { id: 'DT-001', workCenter: 'WC-DS-EXT3', workCenterName: 'Extruder 3', type: 'CIP', startTime: 48, endTime: 64, reason: 'Sunday CIP cycle' },
    { id: 'DT-002', workCenter: 'WC-DS-EXT4', workCenterName: 'Extruder 4', type: 'CIP', startTime: 48, endTime: 64, reason: 'Sunday CIP cycle' },
    { id: 'DT-003', workCenter: 'WC-DS-PKG2', workCenterName: 'Pkg Line 2', type: 'Maintenance', startTime: 120, endTime: 128, reason: 'Scheduled belt replacement' },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SchedulingPage() {
  const [activeTab, setActiveTab] = useState('gantt');
  const [plant, setPlant] = useState('PLT-DOGSTAR');
  const [schedule, setSchedule] = useState(null);

  const fetchSchedule = useCallback(() => {
    fetch(`${API}/schedule/${plant}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSchedule)
      .catch(() => setSchedule(FALLBACK));
  }, [plant]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  /* ─── Handler functions ──────────────────────────────────────────── */
  const handleResequence = async (workCenter, orderIds) => {
    try {
      const res = await fetch(`${API}/resequence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, workCenter, orderIds }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* keep local state */ }
  };

  const handleOptimize = async () => {
    try {
      const res = await fetch(`${API}/optimize/${plant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* ignore */ }
  };

  const handleGenerate = async () => {
    try {
      const res = await fetch(`${API}/generate/${plant}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant }),
      });
      if (res.ok) { const data = await res.json(); setSchedule(data); }
    } catch { /* ignore */ }
  };

  const handleUpdateChangeover = async (fromFam, toFam, hours) => {
    try {
      await fetch(`${API}/changeover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, fromFam, toFam, hours }),
      });
      // Optimistic update
      setSchedule(prev => {
        if (!prev) return prev;
        const key = `${fromFam}|${toFam}`;
        return { ...prev, changeoverMatrix: { ...prev.changeoverMatrix, [key]: hours } };
      });
    } catch { /* ignore */ }
  };

  const handleUpdateConfig = async (rule) => {
    try {
      await fetch(`${API}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, rule }),
      });
      fetchSchedule();
    } catch { /* ignore */ }
  };

  const handleAddDowntime = async (event) => {
    try {
      const res = await fetch(`${API}/downtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, ...event }),
      });
      if (res.ok) fetchSchedule();
      else {
        // Optimistic local add
        setSchedule(prev => {
          if (!prev) return prev;
          const newEvt = { id: `DT-NEW-${Date.now()}`, ...event };
          return { ...prev, downtimeEvents: [...(prev.downtimeEvents || []), newEvt] };
        });
      }
    } catch { /* fallback handled by else branch */ }
  };

  const handleAddOrder = async ({ familyId, qty, workCenter, priority }) => {
    try {
      const res = await fetch(`${API}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantCode: plant, familyId, qty, workCenter, priority }),
      });
      if (res.ok) { const data = await res.json(); if (data.schedule) setSchedule(data.schedule); else fetchSchedule(); }
    } catch { fetchSchedule(); }
  };

  const handleRemoveDowntime = async (eventId) => {
    try {
      await fetch(`${API}/downtime/${eventId}?plantCode=${plant}`, { method: 'DELETE' });
    } catch { /* ignore */ }
    // Optimistic remove
    setSchedule(prev => {
      if (!prev) return prev;
      return { ...prev, downtimeEvents: (prev.downtimeEvents || []).filter((e, i) => (e.id || i) !== eventId) };
    });
  };

  /* ─── KPI values ─────────────────────────────────────────────────── */
  const summary = schedule?.summary || {};
  const kpis = [
    { label: 'Running', value: summary.runningOrders || 0, bg: T.purple, color: T.white },
    { label: 'On Pace', value: summary.completedOrders || 0, bg: T.safe, color: T.white },
    { label: 'Behind', value: summary.delayedOrders || 0, bg: T.risk, color: T.white },
    { label: 'Changeover', value: `${summary.totalChangeoverHours || 0}h`, bg: '#D97706', color: T.white },
  ];

  return (
    <ModuleLayout moduleContext="scheduling" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      <PageHeader
        title="Production Scheduling"
        subtitle="Champion Pet Foods — Scheduling"
      />

      {/* ── Plant toggle + KPI strip ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: T.sp3,
        padding: `${T.sp3}px ${T.sp5}px`, flexWrap: 'wrap',
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Plant buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PLANTS.map(p => (
            <button
              key={p.code}
              onClick={() => setPlant(p.code)}
              style={{
                background: plant === p.code ? T.ink : T.white,
                color: plant === p.code ? T.white : T.ink,
                border: `1px solid ${plant === p.code ? T.ink : T.border}`,
                borderRadius: T.r2, padding: '8px 16px', cursor: 'pointer',
                fontFamily: T.fontMono, fontSize: 11, fontWeight: 500,
                transition: 'all 0.12s',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.border }} />

        {/* KPI pills */}
        <div style={{ display: 'flex', gap: T.sp2, flexWrap: 'wrap' }}>
          {kpis.map(kpi => (
            <div key={kpi.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${kpi.bg}18`, borderRadius: 20,
              padding: '6px 14px',
            }}>
              <span style={{ fontFamily: T.fontBody, fontSize: 11, color: kpi.bg, fontWeight: 500 }}>
                {kpi.label}
              </span>
              <span style={{
                fontFamily: T.fontHeading, fontSize: 14, fontWeight: 700,
                color: kpi.bg,
                background: kpi.bg, WebkitBackgroundClip: 'text',
              }}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {activeTab === 'gantt' && (
        <GanttChartTab
          schedule={schedule}
          plant={plant}
          onResequence={handleResequence}
          onOptimize={handleOptimize}
          onRefresh={fetchSchedule}
          onAddOrder={handleAddOrder}
        />
      )}

      {activeTab === 'shopfloor' && (
        <ShopFloorTab schedule={schedule} plant={plant} />
      )}

      {activeTab === 'setup' && (
        <SetupTab
          schedule={schedule}
          plant={plant}
          onGenerate={handleGenerate}
          onUpdateChangeover={handleUpdateChangeover}
          onUpdateConfig={handleUpdateConfig}
          onAddDowntime={handleAddDowntime}
          onRemoveDowntime={handleRemoveDowntime}
        />
      )}
    </ModuleLayout>
  );
}
