/**
 * Life OS — Cloud Functions Gateway
 * - AI Insights generation via Google Gemini (with caching)
 * - Transactional Welcome & Digest Emails (Trigger Email extension compatible)
 * - Scheduled Timetable push notification dispatch (FCM)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/* ============================================================
   1. AI INSIGHTS GATEWAY (HTTPS Callable)
   Swappable provider architecture supporting Google Gemini
============================================================ */

class GeminiAIProvider {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  async generateInsights(dataSummary) {
    if (!this.apiKey) {
      // Fallback deterministic analysis if key is not yet set
      return {
        summary: `You logged ₹${dataSummary.totalSpent} in spending across ${dataSummary.txCount} transactions, completed ${dataSummary.doneTasks} tasks, and averaged ${dataSummary.avgSleep}h of sleep.`,
        categoryCreep: dataSummary.topCategory ? `Top spending category: ${dataSummary.topCategory.name} (₹${dataSummary.topCategory.amount}).` : "No category spikes detected.",
        suggestions: [
          "Automate fixed monthly expenses into a dedicated budget envelope.",
          "Keep sleep consistent within 30 minutes of your target bedtime.",
          "Review discretionary food and shopping transactions weekly."
        ],
        generatedAt: new Date().toISOString()
      };
    }

    try {
      const { GoogleGenAI } = require("@google/genai");
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const prompt = `You are a warm, concise personal productivity and financial coach for "Life OS".
Analyze the user's data for the past 30 days:
- Spending: ₹${dataSummary.totalSpent} across ${dataSummary.txCount} transactions. Category breakdown: ${JSON.stringify(dataSummary.categoryBreakdown)}.
- Tasks: ${dataSummary.doneTasks} completed out of ${dataSummary.totalTasks} tasks.
- Sleep: Average ${dataSummary.avgSleep} hours/night.

Return ONLY valid JSON with this structure:
{
  "summary": "1-2 sentences summarizing productivity, budget, and wellness",
  "categoryCreep": "1 sentence highlighting the highest or fastest-growing spending area",
  "suggestions": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });

      const text = response.text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(text);
      return {
        ...parsed,
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error("AI Provider error:", err);
      return {
        summary: `Analysis: ₹${dataSummary.totalSpent} total expense with ${dataSummary.doneTasks} tasks accomplished.`,
        categoryCreep: "Category trends analyzed.",
        suggestions: [
          "Review top discretionary categories before month end.",
          "Log time blocks for remaining high-priority tasks.",
          "Maintain regular rest hours to sustain focus."
        ],
        generatedAt: new Date().toISOString()
      };
    }
  }
}

// HTTPS Callable Function
exports.generateInsights = onCall({ cors: true, secrets: ["GEMINI_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to generate insights.");
  }

  const uid = request.auth.uid;
  const period = request.data?.period || new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  const cacheRef = db.doc(`users/${uid}/insights/${period}`);

  // Check Firestore cache within 24 hours
  const cachedSnap = await cacheRef.get();
  if (cachedSnap.exists) {
    const cachedData = cachedSnap.data();
    const ageHours = (Date.now() - new Date(cachedData.generatedAt).getTime()) / (1000 * 60 * 60);
    if (ageHours < 24 && !request.data?.forceRefresh) {
      return cachedData;
    }
  }

  // Aggregate user data from Firestore
  const [txSnap, tasksSnap, sleepSnap] = await Promise.all([
    db.collection(`users/${uid}/transactions`).get(),
    db.collection(`users/${uid}/tasks`).get(),
    db.collection(`users/${uid}/sleep`).get()
  ]);

  const txList = txSnap.docs.map(d => d.data());
  const tasksList = tasksSnap.docs.map(d => d.data());
  const sleepList = sleepSnap.docs.map(d => d.data());

  const expenses = txList.filter(x => x.type === "expense");
  const totalSpent = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const categoryMap = {};
  expenses.forEach(x => {
    const cat = x.category || "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(x.amount) || 0);
  });

  const categoryBreakdown = Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
  const topCategory = categoryBreakdown.sort((a, b) => b.amount - a.amount)[0] || null;

  const doneTasks = tasksList.filter(t => t.done).length;
  const avgSleep = sleepList.length > 0
    ? (sleepList.reduce((s, x) => s + (Number(x.hours) || 0), 0) / sleepList.length).toFixed(1)
    : "7.0";

  const dataSummary = {
    totalSpent,
    txCount: txList.length,
    categoryBreakdown,
    topCategory,
    doneTasks,
    totalTasks: tasksList.length,
    avgSleep
  };

  const aiProvider = new GeminiAIProvider(process.env.GEMINI_API_KEY);
  const result = await aiProvider.generateInsights(dataSummary);

  // Cache in Firestore
  await cacheRef.set(result, { merge: true });

  return result;
});


/* ============================================================
   2. EMAIL GATEWAY (Trigger Email Extension integration)
============================================================ */

// Helper to write to Trigger Email's 'mail' collection
async function queueEmail(to, subject, html) {
  return db.collection("mail").add({
    to,
    message: {
      subject,
      html
    }
  });
}

// Welcome Email on User Sign-up
exports.onUserCreated = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user.email) return;

  const displayName = user.displayName || user.email.split("@")[0];
  const welcomeHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; margin: 0 auto; color: #0E1B33;">
      <h2 style="color: #2F6FED;">Welcome to Life OS, ${displayName}!</h2>
      <p>Your unified day, budget, and wellness command center is ready.</p>
      <ul>
        <li>Schedule your tasks and track priorities</li>
        <li>Organize budgets and import bank/UPI statements</li>
        <li>Track sleep, workouts, and meals effortlessly</li>
      </ul>
      <p style="margin-top: 24px;">To peaceful productivity,<br/>The Life OS Team</p>
    </div>
  `;

  await queueEmail(user.email, "Welcome to Life OS — Your unified command center", welcomeHtml);
});

// Weekly Digest (Every Sunday at 20:00 UTC)
exports.weeklyDigest = onSchedule("every sunday 20:00", async () => {
  const usersSnap = await db.collection("users").get();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userAuth = await admin.auth().getUser(uid).catch(() => null);
    if (!userAuth || !userAuth.email) continue;

    const [tasksSnap, sleepSnap, txSnap] = await Promise.all([
      db.collection(`users/${uid}/tasks`).where("date", ">=", sevenDaysAgo).get(),
      db.collection(`users/${uid}/sleep`).where("date", ">=", sevenDaysAgo).get(),
      db.collection(`users/${uid}/transactions`).where("date", ">=", sevenDaysAgo).get()
    ]);

    const tasksDone = tasksSnap.docs.filter(d => d.data().done).length;
    const sleepDocs = sleepSnap.docs.map(d => d.data());
    const avgSleep = sleepDocs.length > 0
      ? (sleepDocs.reduce((s, x) => s + (Number(x.hours) || 0), 0) / sleepDocs.length).toFixed(1)
      : "0";
    const totalSpent = txSnap.docs
      .filter(d => d.data().type === "expense")
      .reduce((s, d) => s + (Number(d.data().amount) || 0), 0);

    const digestHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto; color: #0E1B33;">
        <h2 style="color: #2F6FED;">Your Weekly Life OS Digest</h2>
        <p>Here is your performance snapshot over the past 7 days:</p>
        <div style="background: #F4F8FE; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p><strong>✅ Tasks completed:</strong> ${tasksDone}</p>
          <p><strong>🌙 Sleep average:</strong> ${avgSleep} hours/night</p>
          <p><strong>💳 Total spent:</strong> ₹${totalSpent.toLocaleString()}</p>
        </div>
        <p><a href="https://lifeos-61443.web.app" style="color: #2F6FED; font-weight: bold;">Open Life OS Dashboard →</a></p>
      </div>
    `;

    await queueEmail(userAuth.email, "Your Life OS Weekly Digest", digestHtml);
  }
});

// Monthly Digest (1st of every month at 08:00 UTC)
exports.monthlyDigest = onSchedule("0 8 1 * *", async () => {
  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userAuth = await admin.auth().getUser(uid).catch(() => null);
    if (!userAuth || !userAuth.email) continue;

    const digestHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto; color: #0E1B33;">
        <h2 style="color: #2F6FED;">Monthly Reflection — Life OS</h2>
        <p>A fresh month has started! Log in to view your 30-day analytics, AI financial insights, and sleep consistency trends.</p>
        <p><a href="https://lifeos-61443.web.app" style="color: #2F6FED; font-weight: bold;">View Full Monthly Report →</a></p>
      </div>
    `;

    await queueEmail(userAuth.email, "Your Monthly Life OS Report", digestHtml);
  }
});


/* ============================================================
   3. DAILY REMINDER TRIGGER (Every 15 minutes)
   Checks timetable blocks and sends push notifications
============================================================ */

exports.checkTimetableReminders = onSchedule("every 15 minutes", async () => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = String(now.getHours()).padStart(2, "0");
  const currentMin = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHour}:${currentMin}`;

  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    // Get tokens
    const tokensSnap = await db.collection(`users/${uid}/pushTokens`).get();
    if (tokensSnap.empty) continue;
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

    // Get timetable blocks scheduled for today
    const blocksSnap = await db.collection(`users/${uid}/timetable`)
      .where("date", "==", today)
      .where("done", "==", false)
      .get();

    for (const bDoc of blocksSnap.docs) {
      const b = bDoc.data();
      // If block matches current time window
      if (b.time && b.time >= currentTime && b.time <= currentTime) {
        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "Life OS Scheduled Block",
            body: `${b.time}: ${b.label}`
          }
        }).catch(err => console.error("FCM send error:", err));
      }
    }
  }
});
