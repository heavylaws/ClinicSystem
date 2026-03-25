import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── List all users (admin only) ────────────────────────────────────

router.get("/", requireRole("admin"), async (_req, res) => {
    try {
        const allUsers = await db
            .select({
                id: users.id,
                username: users.username,
                displayName: users.displayName,
                role: users.role,
                isActive: users.isActive,
                createdAt: users.createdAt,
            })
            .from(users)
            .orderBy(desc(users.createdAt));
        res.json(allUsers);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create user (admin only) ───────────────────────────────────────

router.post("/", requireRole("admin"), async (req, res) => {
    try {
        const { username, password, displayName, role } = req.body;
        if (!username || !password || !displayName) {
            return res.status(400).json({ error: "username, password, displayName are required" });
        }

        // Check unique username
        const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (existing) return res.status(409).json({ error: "Username already exists" });

        const hash = await bcrypt.hash(password, 10);
        const [user] = await db
            .insert(users)
            .values({ username, password: hash, displayName, role: role || "reception" })
            .returning();

        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update user (admin only) ───────────────────────────────────────

router.put("/:id", requireRole("admin"), async (req, res) => {
    try {
        const userId = req.params.id as string;
        const { displayName, role, isActive } = req.body;

        const updates: any = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (role !== undefined) updates.role = role;
        if (isActive !== undefined) updates.isActive = isActive;
        updates.updatedAt = new Date();

        const [user] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, userId))
            .returning();

        if (!user) return res.status(404).json({ error: "User not found" });
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Reset user password (admin only) ───────────────────────────────

router.patch("/:id/reset-password", requireRole("admin"), async (req, res) => {
    try {
        const userId = req.params.id as string;
        const { password } = req.body;
        if (!password || password.length < 4) {
            return res.status(400).json({ error: "Password must be at least 4 characters" });
        }

        const hash = await bcrypt.hash(password, 10);
        const [user] = await db
            .update(users)
            .set({ password: hash, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();

        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Change own password (any authenticated user) ───────────────────

router.patch("/change-password", async (req, res) => {
    try {
        const currentUser = req.user as any;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current and new password required" });
        }
        if (newPassword.length < 4) {
            return res.status(400).json({ error: "New password must be at least 4 characters" });
        }

        // Verify current password
        const [user] = await db.select().from(users).where(eq(users.id, currentUser.id)).limit(1);
        if (!user) return res.status(404).json({ error: "User not found" });

        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

        const hash = await bcrypt.hash(newPassword, 10);
        await db.update(users).set({ password: hash, updatedAt: new Date() }).where(eq(users.id, currentUser.id));

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as userRouter };
