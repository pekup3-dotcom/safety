/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let's parser JSON bodies up to 20MB for photo uploads
  app.use(express.json({ limit: '20mb' }));

  // File-backed persistence configuration
  const DATA_FILE = path.join(process.cwd(), 'projects-data.json');
  let projectsList: any[] = [];

  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      projectsList = JSON.parse(fileData);
    } else {
      // Create high-fidelity sample project for initial loading
      const sampleProject = {
        id: 'demo-project-id',
        name: '서울가산디지털 테크노타워',
        inspectionCompany: '(주)중앙 건설안전 진단원',
        facilitiesRaw: '테크노타워A, 주차빌딩',
        facilitiesList: ['테크노타워A', '주차빌딩'],
        basementFloors: 2,
        abovegroundFloors: 5,
        floorOptions: [
          '지상5층', '지상4층', '지상3층', '지상2층', '지상1층',
          '지하1층', '지하2층'
        ],
        drawingUrl: null,
        drawingName: null,
        damages: [
          {
            id: 'dmg-sample-1',
            no: 1,
            type: '균열',
            cause: '콘크리트 건조수축 (Drying Shrinkage)',
            floor: '지상3층',
            member: '벽체',
            widthVal: 0.3,
            lengthVal: 1.5,
            photoUrls: [],
            marker: { x: 35.5, y: 30.2 }
          },
          {
            id: 'dmg-sample-2',
            no: 2,
            type: '누수',
            cause: '방수층 파손 및 열화 (Waterproof Layer Damage)',
            floor: '지하1층',
            member: '슬래브',
            widthVal: 1.2,
            lengthVal: 0.8,
            areaVal: 1.1,
            photoUrls: [],
            marker: { x: 36.3, y: 31.1 }
          },
          {
            id: 'dmg-sample-3',
            no: 3,
            type: '백화',
            cause: '배면 누수 및 만성 습기 유지 (Chronic Backing Moisture)',
            floor: '지하2층',
            member: '기둥',
            widthVal: 0.5,
            lengthVal: 1.2,
            areaVal: 0.6,
            photoUrls: [],
            marker: { x: 70.0, y: 55.4 }
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      projectsList = [sampleProject];
      fs.writeFileSync(DATA_FILE, JSON.stringify(projectsList, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error("Failed to load or initialize backend datastore:", error);
  }

  // Active connected SSE streams
  let sseClients: any[] = [];

  function broadcast(type: string, data: any) {
    console.log(`Broadcasting real-time update to ${sseClients.length} active sessions.`);
    const payload = JSON.stringify({ type, data });
    sseClients.forEach((client) => {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.error("Fail writing to client stream:", err);
      }
    });
  }

  // SSE Subscription Endpoint
  app.get('/api/projects/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.write(': connected\n\n');
    res.write(`data: ${JSON.stringify({ type: 'SYNC', data: projectsList })}\n\n`);

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
  });

  // REST API: Load Projects
  app.get('/api/projects', (req, res) => {
    res.json(projectsList);
  });

  // REST API: Save or Update Project
  app.post('/api/projects', (req, res) => {
    try {
      const updatedProject = req.body;
      if (!updatedProject || !updatedProject.id) {
        return res.status(400).json({ error: 'Missing correct project payload' });
      }

      const index = projectsList.findIndex(p => p.id === updatedProject.id);
      if (index !== -1) {
        projectsList[index] = {
          ...projectsList[index],
          ...updatedProject,
          updatedAt: new Date().toISOString()
        };
      } else {
        projectsList.unshift(updatedProject);
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(projectsList, null, 2), 'utf-8');
      broadcast('UPDATE', projectsList);
      return res.json({ status: 'ok', projects: projectsList });
    } catch (err: any) {
      console.error("Save project failed:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // REST API: Sync complete dataset
  app.post('/api/projects/sync-all', (req, res) => {
    try {
      const fullList = req.body;
      if (Array.isArray(fullList)) {
        projectsList = fullList;
        fs.writeFileSync(DATA_FILE, JSON.stringify(projectsList, null, 2), 'utf-8');
        broadcast('UPDATE', projectsList);
        return res.json({ status: 'ok', projects: projectsList });
      }
      return res.status(400).json({ error: 'Invalid payload, must be array' });
    } catch (err: any) {
       return res.status(500).json({ error: err.message });
    }
  });

  // REST API: Delete Project
  app.delete('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      projectsList = projectsList.filter(p => p.id !== id);
      fs.writeFileSync(DATA_FILE, JSON.stringify(projectsList, null, 2), 'utf-8');
      broadcast('UPDATE', projectsList);
      return res.json({ status: 'ok', projects: projectsList });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route - Gemini scan assistance for site inspectors
  app.post('/api/gemini/scan', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { image, mimeType } = req.body;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        console.warn("GEMINI_API_KEY is not configured. Falling back to default assistant outline.");
        // Non-crashing default fallback response helper
        return res.json({
          boundingBoxes: [
            { x: 30, y: 30, width: 40, height: 40 }
          ],
          suggestedSize: "폭 0.2mm (시스템 설정 영역의 Secrets에 GEMINI_API_KEY를 입력하면 정밀 스캔이 구동됩니다)",
          isFallback: true
        });
      }

      if (!image) {
        return res.status(400).json({ error: "No image base64 provided" });
      }

      // Initialize the official GoogleGenAI backend client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare image part
      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: image,
        },
      };

      const promptPart = {
        text: "You are a professional architectural structural safety diagnostics expert. Analyze this close-up photograph of a concrete/mortar structural defect. Identify any structural defects such as cracks (균열), leakage (누수), efflorescence (백화), concrete spalling/delamination (박리박락), rebar exposure/rust (철근노출), masonry crack, finishing peel. Estimate the bounding box coordinate of the defect, and suggest an approximate physical size (for cracks, estimate width in mm e.g. '0.2mm' or '0.5mm'; for leakage or spalling, estimate dimensions in meters e.g. '1.2m x 0.8m'). Use high resolution scaling for coordinates.",
      };

      // Query Gemini 3.5 Flash utilizing strict response schema for reliable JSON outputs
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [imagePart, promptPart],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              boundingBoxes: {
                type: Type.ARRAY,
                description: "Array of coordinates enclosing visible structural defects (e.g. concrete cracks, water leakage, or exposed rebars)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER, description: "X coordinate of top-left box corner in percentage (0-100) of drawing width" },
                    y: { type: Type.NUMBER, description: "Y coordinate of top-left box corner in percentage (0-100) of drawing height" },
                    width: { type: Type.NUMBER, description: "Width of the box in percentage (0-100)" },
                    height: { type: Type.NUMBER, description: "Height of the box in percentage (0-100)" },
                  },
                  required: ["x", "y", "width", "height"]
                }
              },
              suggestedSize: {
                type: Type.STRING,
                description: "Estimated numeric values with units based on visual cues (e.g., '0.3mm' or '0.6m x 1.2m')"
              }
            },
            required: ["boundingBoxes", "suggestedSize"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      
      return res.json({
        boundingBoxes: parsedData.boundingBoxes || [],
        suggestedSize: parsedData.suggestedSize || "폭 0.2mm",
        isFallback: false
      });

    } catch (error: any) {
      console.error("Gemini API scan error in backend:", error);
      return res.status(500).json({
        error: error.message || "Failed to utilize AI scanning capability",
        boundingBoxes: [{ x: 40, y: 40, width: 20, height: 20 }],
        suggestedSize: "폭 0.2mm",
        isFallback: true
      });
    }
  });

  // Serve static assets in production, use Vite in development
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Construction Safety Diagnostics Express server running at URL on port ${PORT}`);
  });
}

startServer();
