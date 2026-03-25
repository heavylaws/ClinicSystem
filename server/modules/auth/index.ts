import { Router } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { Express, Request, Response, NextFunction } from "express";

const router = Router();

// ─── Passport Setup ─────────────────────────────────────────────────

export function setupPassport(app: Express) {
    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.username, username))
                    .limit(1);

                if (!user) return done(null, false, { message: "Invalid credentials" });
                if (!user.isActive) return done(null, false, { message: "Account disabled" });

                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return done(null, false, { message: "Invalid credentials" });

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        })
    );

    passport.serializeUser((user: any, done) => done(null, user.id));
    passport.deserializeUser(async (id: string, done) => {
        try {
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, id))
                .limit(1);
            done(null, user || null);
        } catch (err) {
            done(err);
        }
    });

    app.use(passport.initialize());
    app.use(passport.session());
}

// ─── Auth Middleware ─────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "Not authenticated" });
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const user = req.user as any;
        if (!roles.includes(user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}

// ─── Routes ─────────────────────────────────────────────────────────

router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info?.message || "Login failed" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            const { password, ...safeUser } = user;
            res.json(safeUser);
        });
    })(req, res, next);
});

router.post("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: "Logout failed" });
        res.json({ success: true });
    });
});

router.get("/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const user = req.user as any;
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// ─── Bootstrap: create default admin if no users exist ──────────────

router.post("/bootstrap", async (req, res) => {
    try {
        const existing = await db.select().from(users).limit(1);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Users already exist" });
        }

        const hash = await bcrypt.hash("admin123", 10);
        const [admin] = await db
            .insert(users)
            .values({
                username: "admin",
                password: hash,
                displayName: "Admin",
                role: "admin",
            })
            .returning();

        // Also create a doctor user
        const docHash = await bcrypt.hash("doctor123", 10);
        const [doctor] = await db
            .insert(users)
            .values({
                username: "doctor",
                password: docHash,
                displayName: "Doctor",
                role: "doctor",
            })
            .returning();

        // And a reception user
        const recHash = await bcrypt.hash("reception123", 10);
        const [reception] = await db
            .insert(users)
            .values({
                username: "reception",
                password: recHash,
                displayName: "Reception",
                role: "reception",
            })
            .returning();

        res.json({
            message: "Default users created",
            users: [
                { username: "admin", role: "admin" },
                { username: "doctor", role: "doctor" },
                { username: "reception", role: "reception" },
            ],
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as authRouter };
