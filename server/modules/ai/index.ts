import { Router, Request, Response } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/extract", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            res.status(500).json({ error: "Gemini API key is missing. Please configure GEMINI_API_KEY." });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
Extract the patient demographic information from this document.
Return a JSON object exactly matching the structure below.
Do not include markdown formatting or explanations, just the JSON.
{
    "firstName": "string",
    "lastName": "string",
    "fatherName": "string",
    "gender": "Male" | "Female" | null,
    "dateOfBirth": "YYYY-MM-DD",
    "phone": "string",
    "city": "string",
    "region": "string",
    "maritalStatus": "Single" | "Married" | "Divorced" | "Widowed" | null,
    "allergies": "string",
    "chronicConditions": "string",
    "notes": "string"
}
If a field cannot be found, omit it or set it to null.
        `.trim();

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: req.file.buffer.toString("base64"),
                                mimeType: req.file.mimetype,
                            }
                        }
                    ],
                },
            ],
            config: {
                // @ts-ignore
                responseMimeType: "application/json",
            }
        });

        const textRes = response.text || "{}";
        let parsed = {};
        try {
            parsed = JSON.parse(textRes);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", textRes);
            res.status(500).json({ error: "AI returned invalid JSON" });
            return;
        }

        res.json({ data: parsed });

    } catch (error: any) {
        console.error("AI extraction error:", error);
        res.status(500).json({ error: error.message || "Failed to extract data" });
    }
});

export { router as aiRouter };
