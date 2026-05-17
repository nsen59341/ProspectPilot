import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import serverless from "serverless-http";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---

  /**
   * Search Leads via Geoapify
   */
  app.post("/api/search-leads", async (req, res) => {
    const { niche, city, state, geoapifyKey } = req.body;
    const apiKey = geoapifyKey || process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
      console.error("Geoapify API Key is missing in environment variables.");
      return res.status(400).json({ error: "Geoapify API Key is missing. Please set it in the Secrets panel." });
    }

    try {
      // Step 1: Geocoding
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=USA&format=json&apiKey=${apiKey}`;
      const geoRes = await axios.get(geoUrl);
      
      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        return res.status(404).json({ error: "Location not found." });
      }

      const { lat, lon, place_id } = geoRes.data.results[0];

      // Step 2: Places API
      const categories = req.body.categories || "service";
      let placesUrl = `https://api.geoapify.com/v2/places?categories=${categories}&filter=place:${place_id}&limit=20&apiKey=${apiKey}`;
      
      let placesRes = await axios.get(placesUrl);

      // Fallback
      if (!placesRes.data.features || placesRes.data.features.length === 0) {
        placesUrl = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lon},${lat},15000&limit=20&apiKey=${apiKey}`;
        placesRes = await axios.get(placesUrl);
      }

      const leads = (placesRes.data.features || [])
        .map((f: any) => ({
          name: f.properties.name || "Unknown Business",
          website: f.properties.website,
          address: f.properties.address_line2,
          city: f.properties.city,
          state: f.properties.state,
          place_id: f.properties.place_id,
        }))
        .filter((l: any) => l.website && l.website.startsWith("http"));

      res.json({ leads });
    } catch (error: any) {
      console.error("Search Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch leads." });
    }
  });

  /**
   * Process Single Lead
   */
  app.post("/api/process-lead", async (req, res) => {
    const { website, name, niche } = req.body;
    
    try {
      // 1. Email Extraction
      const foundEmails = await extractEmailsFromWebsite(website);
      const bestEmail = sortEmails(foundEmails)[0] || null;

      // 2. Capture Screenshot (Microlink)
      let screenshotBase64 = "";
      let screenshotUrl = "";
      try {
        const microlinkRes = await axios.get(`https://api.microlink.io/?url=${encodeURIComponent(website)}&screenshot=true&meta=false`, { timeout: 10000 });
        screenshotUrl = microlinkRes.data.data.screenshot.url;
        
        if (screenshotUrl) {
          const imageRes = await axios.get(screenshotUrl, { responseType: 'arraybuffer', timeout: 10000 });
          screenshotBase64 = Buffer.from(imageRes.data).toString('base64');
        }
      } catch (err: any) {
        console.error("Screenshot Error:", err.message);
      }

      // 3. AI Audit (Gemini Vision)
      let auditResult = { score: 50, findings: "Could not audit website screenshot accurately." };
      if (screenshotBase64) {
        const visionPrompt = `Analyze this website screenshot for a ${niche || 'business'} named "${name}". 
        Provide a JSON response with:
        - "score": (integer 0-100) based on UI/UX, modern feel, and conversion optimization.
        - "findings": A short summary (max 30 words) of 2-3 specific technical or design gaps (e.g. "hero section lacks a clear CTA", "mobile responsiveness issues", "outdated typography").
        Refrain from flattery. Be objective and critical.`;

        const visionResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: visionPrompt },
              { inlineData: { mimeType: "image/png", data: screenshotBase64 } }
            ]
          }
        });

        const text = visionResponse.text || "";
        try {
          // Clean up potential markdown formatting if Gemini returns it
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          auditResult = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch (e) {
          console.error("Audit Parse Error:", e, "Raw Text:", text);
        }
      }

      // 4. Draft Email (Gemini Text)
      const emailPrompt = `Draft a cold email to ${name} based on these website audit findings: "${auditResult.findings}".
      Website URL: ${website}
      
      Framework: "Observation -> Insight -> Gap".
      Rules:
      - No flattery. 
      - No "I hope you're well". 
      - No "I noticed your website".
      - Subject: 2-4 words, lowercase, specific.
      - Body: "I was looking at your site and the [Specific Detail] is [Problem]. Usually, this makes it harder for customers to [Action]. I recorded a 2-min video on how to fix this. Worth a look?"
      - Signature: "Animesh, ProspectPilot"
      
      Return JSON: { "subject": "...", "body": "..." }`;

      const emailResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: emailPrompt }] }
      });
      const emailText = emailResponse.text || "";
      let emailDraft = { subject: "", body: "" };
      try {
        const jsonMatch = emailText.match(/\{[\s\S]*\}/);
        emailDraft = JSON.parse(jsonMatch ? jsonMatch[0] : emailText);
      } catch (e) {
        console.error("Email Draft Parse Error:", e, "Raw Text:", emailText);
      }

      res.json({
        email: bestEmail,
        audit: auditResult,
        draft: emailDraft,
        screenshot: screenshotUrl
      });
    } catch (error: any) {
      console.error("Process Error:", error.message, error.response?.data);
      res.status(500).json({ error: `Process Error: ${error.message}` });
    }
  });

  // --- Helper Functions ---

  async function extractEmailsFromWebsite(baseUrl: string) {
    const urlsToScrape = [
      baseUrl,
      joinUrl(baseUrl, "/contact"),
      joinUrl(baseUrl, "/contact-us"),
      joinUrl(baseUrl, "/about"),
      joinUrl(baseUrl, "/about-us"),
      joinUrl(baseUrl, "/team")
    ];

    const emails = new Set<string>();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    for (const url of urlsToScrape) {
      try {
        const response = await axios.get(url, { 
          timeout: 5000, 
          validateStatus: (status) => status < 500,
          headers: { 'User-Agent': 'ProspectPilot/1.0' }
        });
        
        if (response.status !== 200) continue;

        const html = response.data;
        const found = html.match(emailRegex);
        if (found) {
          found.forEach((e: string) => {
            const clean = e.toLowerCase().trim();
            if (isValidEmail(clean)) {
              emails.add(clean);
            }
          });
        }
      } catch (err) {
        // Silent failure for single page
      }
    }

    return Array.from(emails);
  }

  function isValidEmail(email: string) {
    const junk = ['noreply', 'sentry', 'wix', 'godaddy', 'example', 'domain.com'];
    if (junk.some(j => email.includes(j))) return false;
    if (email.match(/\.(png|jpg|jpeg|gif|webp|svg|2x|3x)$/)) return false;
    return true;
  }

  function sortEmails(emails: string[]) {
    return emails.sort((a, b) => {
      const aIsPersonal = a.includes('.');
      const bIsPersonal = b.includes('.');
      if (aIsPersonal && !bIsPersonal) return -1;
      if (!aIsPersonal && bIsPersonal) return 1;
      
      const priority = ['info@', 'contact@', 'hello@', 'support@'];
      const aIndex = priority.findIndex(p => a.startsWith(p));
      const bIndex = priority.findIndex(p => b.startsWith(p));
      
      if (aIndex !== -1 && bIndex === -1) return -1;
      if (aIndex === -1 && bIndex !== -1) return 1;
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      
      return 0;
    });
  }

  function joinUrl(base: string, path: string) {
    return base.replace(/\/$/, '') + path;
  }

  // --- Vite & Static Handling ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.LAMBDA_TASK_ROOT) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export const handler = serverless(async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
});
