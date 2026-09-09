import React, { useState, useMemo } from "react";
import {
  Moon, Dumbbell, Utensils, Scale, Flame, Activity, Check,
  TrendingDown, TrendingUp, Info, Droplets, Target, Sparkles,
  Clock, Award, Zap, CheckCircle2, AlertTriangle, Plus, ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { inputStyle, todayStr, dayName } from "../theme";
import { Card, Screen, Empty, Segmented, PrimaryButton, GhostButton, Field } from "./primitives";
import { addItem, updateItem } from "../firestore";
import CopyrightFooter from "./CopyrightFooter";

export default function HealthScreen({ t, sleep = [], workouts = [], meals = [], userId, bodyMetrics = [] }) {
  const [sub, setSub] = useState("goals"); // "goals", "workout", "diet", "bmi", "sleep"
  const [bed, setBed] = useState("23:30");
  const [wake, setWake] = useState("07:00");
  const [exName, setExName] = useState("");
  const [exMin, setExMin] = useState("");
  const [mealName, setMealName] = useState("");
  const [mealCal, setMealCal] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");

  // Goal & Customization State
  const [selectedGoal, setSelectedGoal] = useState(() => {
    return localStorage.getItem("lifeos_health_goal") || "fat_loss";
  });

  const handleGoalSelect = (goalKey) => {
    setSelectedGoal(goalKey);
    localStorage.setItem("lifeos_health_goal", goalKey);
    setActionFeedback("Health goal updated!");
    setTimeout(() => setActionFeedback(""), 1500);
  };

  // BMI & Calorie Calculator State
  const latestMetric = bodyMetrics[0] || {};
  const [weight, setWeight] = useState(latestMetric.weight || "72");
  const [height, setHeight] = useState(latestMetric.height || "175");
  const [age, setAge] = useState(latestMetric.age || "25");
  const [gender, setGender] = useState(latestMetric.gender || "male");
  const [activity, setActivity] = useState(latestMetric.activity || "1.375"); // Light exercise
  const [saveMsg, setSaveMsg] = useState("");

  // Calculations
  const bmiData = useMemo(() => {
    const w = parseFloat(weight) || 70;
    const h = (parseFloat(height) || 175) / 100;
    const bmi = parseFloat((w / (h * h)).toFixed(1));

    let category = "Normal weight";
    let color = t.good;
    let description = "You are in a healthy weight range.";

    if (bmi < 18.5) {
      category = "Underweight";
      color = t.a2;
      description = "Consider calorie surplus to build healthy lean muscle.";
    } else if (bmi >= 18.5 && bmi < 25) {
      category = "Healthy / Normal";
      color = t.good;
      description = "Optimal body weight. Focus on tone, strength, and longevity.";
    } else if (bmi >= 25 && bmi < 30) {
      category = "Overweight";
      color = t.a1;
      description = "Caloric deficit and resistance training will yield strong fat loss results.";
    } else {
      category = "Obese";
      color = t.warm;
      description = "Prioritize sustained fat loss through dietary deficit and regular walking/cardio.";
    }

    const a = parseFloat(age) || 25;
    let bmr = 10 * w + 6.25 * parseFloat(height) - 5 * a;
    bmr = gender === "female" ? bmr - 161 : bmr + 5;
    bmr = Math.round(bmr);

    const actMult = parseFloat(activity) || 1.375;
    const tdee = Math.round(bmr * actMult);

    return {
      bmi,
      category,
      color,
      description,
      bmr,
      tdee,
      fatLossCalories: Math.max(1200, tdee - 500),
      muscleGainCalories: tdee + 350,
      maintenanceCalories: tdee,
      recompCalories: tdee - 150,
      proteinGrams: Math.round(w * 2.0),
      waterLiters: (w * 0.035).toFixed(1)
    };
  }, [weight, height, age, gender, activity, t]);

  // Goal Plans & Suggested Workouts
  const GOAL_PLANS = {
    fat_loss: {
      name: "Fat Loss & Shred (Cut)",
      badge: "Lean & Toned",
      color: t.good,
      icon: TrendingDown,
      targetCalories: bmiData.fatLossCalories,
      calorieDesc: `Aim for ~${bmiData.fatLossCalories} kcal/day (-500 kcal deficit)`,
      targetGymMinsWeek: 200,
      workoutDaysWeek: "4–5 days",
      focus: "High-density resistance training + Zone 2 Cardio to preserve muscle while shedding fat.",
      workouts: [
        { name: "Full Body Fat Burner Circuit", mins: 45, type: "Circuit", desc: "Goblet Squats, Pushups, Dumbbell Rows, Kettlebell Swings (4 rounds)" },
        { name: "Incline Treadmill Zone-2 Walk", mins: 30, type: "Cardio", desc: "12% incline at 4.5 km/h for steady state fat oxidation" },
        { name: "HIIT Sprints & Core Circuit", mins: 35, type: "HIIT", desc: "30s sprint / 30s rest (10 rounds) + Hanging Leg Raises & Planks" },
        { name: "Upper Body Hypertrophy + Finisher", mins: 50, type: "Strength", desc: "Bench Press, Lat Pulldowns, Overhead Press + 10 min Stairmaster" }
      ]
    },
    muscle_gain: {
      name: "Muscle Hypertrophy & Bulk",
      badge: "Size & Strength",
      color: t.a1,
      icon: TrendingUp,
      targetCalories: bmiData.muscleGainCalories,
      calorieDesc: `Aim for ~${bmiData.muscleGainCalories} kcal/day (+350 kcal surplus)`,
      targetGymMinsWeek: 240,
      workoutDaysWeek: "4–5 days",
      focus: "Heavy compound lifting with progressive overload to trigger maximal muscle protein synthesis.",
      workouts: [
        { name: "Push Day (Chest, Shoulders, Triceps)", mins: 60, type: "Strength", desc: "Barbell Bench 4x8, Incline DB Press 3x10, Lateral Raises 4x15, Dips 3x12" },
        { name: "Pull Day (Back & Biceps)", mins: 60, type: "Strength", desc: "Deadlifts 3x5, Barbell Rows 4x8, Lat Pulldowns 3x10, Incline Curls 3x12" },
        { name: "Leg Day (Quads & Hamstrings)", mins: 60, type: "Strength", desc: "Barbell Back Squat 4x8, Romanian Deadlift 3x10, Leg Press 3x12, Calves" },
        { name: "Upper Body Power Split", mins: 55, type: "Hypertrophy", desc: "Overhead Press 4x6, Weighted Pull-ups 3x8, Incline DB Flyes 3x12" }
      ]
    },
    recomp: {
      name: "Body Recomposition",
      badge: "Build Muscle + Lose Fat",
      color: t.a2,
      icon: Activity,
      targetCalories: bmiData.recompCalories,
      calorieDesc: `Aim for ~${bmiData.recompCalories} kcal/day (Slight -150 kcal deficit with high protein)`,
      targetGymMinsWeek: 220,
      workoutDaysWeek: "4 days",
      focus: "High-protein intake (2g/kg) coupled with demanding hypertrophy workouts.",
      workouts: [
        { name: "Upper Body Strength & Arms", mins: 55, type: "Hybrid", desc: "Incline Bench, T-Bar Rows, Shoulder Press, Superset Biceps/Triceps" },
        { name: "Lower Body & Core Stability", mins: 50, type: "Hybrid", desc: "Front Squats 4x8, Walking Lunges 3x12, Hanging Leg Raises 4x15" },
        { name: "Push/Pull Density Training", mins: 50, type: "Strength", desc: "Opposing muscle supersets with minimal rest for metabolic stimulus" },
        { name: "Interval Cardio & Mobility Reset", mins: 35, type: "Recovery", desc: "Rowing Machine intervals 5x500m + deep hip/spine mobility" }
      ]
    },
    endurance: {
      name: "Endurance & Stamina",
      badge: "Cardio & Lung Capacity",
      color: t.good,
      icon: Zap,
      targetCalories: bmiData.maintenanceCalories,
      calorieDesc: `Aim for ~${bmiData.maintenanceCalories} kcal/day with healthy complex carbs`,
      targetGymMinsWeek: 210,
      workoutDaysWeek: "4–5 days",
      focus: "Sustained aerobic power, threshold intervals, and muscular endurance.",
      workouts: [
        { name: "5K Tempo Pace Run", mins: 35, type: "Running", desc: "Progressive pace run keeping heart rate in Zone 3/4" },
        { name: "Rowing & Ski-Erg Intervals", mins: 40, type: "Endurance", desc: "1000m row warm-up, 500m sprint intervals with 1 min rest" },
        { name: "Bodyweight Stamina Circuit", mins: 40, type: "Calisthenics", desc: "Pullups, Dips, Pushups, Air Squats with strict tempo" },
        { name: "Cycling / Spin Hill Climb", mins: 45, type: "Cycling", desc: "High-cadence flats mixed with 5x 3-minute steep resistance climbs" }
      ]
    }
  };

  const currentGoalPlan = GOAL_PLANS[selectedGoal] || GOAL_PLANS.fat_loss;

  // Trackers for Goal Achievement
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekWorkouts = workouts.filter(w => (!w.date || w.date >= sevenDaysAgo));
  const totalGymMinsThisWeek = weekWorkouts.reduce((s, w) => s + (Number(w.minutes) || 0), 0);
  const gymSessionsCount = weekWorkouts.length;

  const todayMeals = meals.filter(m => m.date === todayStr());
  const todayCalories = todayMeals.reduce((s, m) => s + (Number(m.cal) || 0), 0);

  // Goal Achievement Scoring
  const gymAdherencePct = Math.min(100, Math.round((totalGymMinsThisWeek / currentGoalPlan.targetGymMinsWeek) * 100));

  // Calorie Status
  let calorieStatus = { text: "No meals logged today", onTrack: null, badge: "Pending" };
  if (todayCalories > 0) {
    const diff = todayCalories - currentGoalPlan.targetCalories;
    if (selectedGoal === "fat_loss") {
      if (diff <= 100) {
        calorieStatus = { text: `Target Met: ₹${todayCalories} kcal consumed (Within ${currentGoalPlan.targetCalories} limit)`, onTrack: true, badge: "Optimal Deficit" };
      } else {
        calorieStatus = { text: `${diff} kcal over cutting target`, onTrack: false, badge: "Over Target" };
      }
    } else if (selectedGoal === "muscle_gain") {
      if (todayCalories >= bmiData.tdee) {
        calorieStatus = { text: `Surplus Hit: ${todayCalories} kcal consumed (Anabolic zone)`, onTrack: true, badge: "Surplus Hit" };
      } else {
        calorieStatus = { text: `${bmiData.tdee - todayCalories} kcal under maintenance. Eat more!`, onTrack: false, badge: "Under Target" };
      }
    } else {
      if (Math.abs(diff) < 250) {
        calorieStatus = { text: `Calorie equilibrium maintained (${todayCalories} kcal)`, onTrack: true, badge: "Balanced" };
      } else {
        calorieStatus = { text: `${todayCalories} kcal logged`, onTrack: true, badge: "Logged" };
      }
    }
  }

  // Composite Fitness Goal Status
  const isCrushingGoal = gymAdherencePct >= 70 && (calorieStatus.onTrack !== false);
  const goalAchievementStatus = isCrushingGoal
    ? { title: "On Track & Achieving Goal! 🏆", desc: "Your weekly workout volume and nutrition discipline align directly with your target.", color: t.good }
    : gymAdherencePct >= 40
    ? { title: "Progressing — Pick Up Pace ⚡", desc: `You've completed ${totalGymMinsThisWeek} of ${currentGoalPlan.targetGymMinsWeek} gym minutes this week.`, color: t.a1 }
    : { title: "Behind Fitness Target ⏳", desc: `Need ${currentGoalPlan.targetGymMinsWeek - totalGymMinsThisWeek} more workout minutes to hit this week's milestone.`, color: t.warm };

  // Quick Action: Add Suggested Workout to Logged Workouts
  const handleQuickLogWorkout = async (w) => {
    await addItem(userId, "workouts", {
      date: todayStr(),
      name: w.name,
      minutes: w.mins
    });
    setActionFeedback(`Logged "${w.name}" (${w.mins} min)!`);
    setTimeout(() => setActionFeedback(""), 2000);
  };

  // Quick Action: Schedule in Timetable
  const handleQuickScheduleWorkout = async (w) => {
    await addItem(userId, "timetable", {
      date: todayStr(),
      time: "18:00",
      label: `🏋️ Gym: ${w.name} (${w.mins}m)`,
      done: false
    });
    setActionFeedback(`Scheduled "${w.name}" in today's Timetable!`);
    setTimeout(() => setActionFeedback(""), 2000);
  };

  const handleSaveBodyMetrics = async () => {
    if (!weight || !height) return;
    await addItem(userId, "bodyMetrics", {
      date: todayStr(),
      weight: parseFloat(weight),
      height: parseFloat(height),
      age: parseInt(age) || 25,
      gender,
      activity: parseFloat(activity) || 1.375,
      bmi: bmiData?.bmi || 0
    });
    setSaveMsg("Body metrics saved successfully!");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const logSleep = async () => {
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins < 0) mins += 24 * 60;
    await addItem(userId, "sleep", { date: todayStr(), bed, wake, hours: +(mins / 60).toFixed(1) });
  };
  const avgSleep = sleep.length ? (sleep.reduce((s, x) => s + (Number(x.hours) || 0), 0) / sleep.length).toFixed(1) : 0;

  const logWorkout = async () => {
    if (!exName || !exMin) return;
    await addItem(userId, "workouts", { date: todayStr(), name: exName, minutes: +exMin });
    setExName(""); setExMin("");
  };

  const logMeal = async () => {
    if (!mealName || !mealCal) return;
    await addItem(userId, "meals", { date: todayStr(), name: mealName, cal: +mealCal });
    setMealName(""); setMealCal("");
  };

  return (
    <Screen t={t} title="Health, Goals & Workouts">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        
        {/* Navigation Tabs */}
        <Segmented
          t={t}
          value={sub}
          onChange={setSub}
          options={[
            ["goals", "Goals & AI Coach", Target],
            ["workout", "Workouts", Dumbbell],
            ["diet", "Diet & Kcal", Utensils],
            ["bmi", "BMI & Calculator", Scale],
            ["sleep", "Sleep", Moon]
          ]}
        />

        {actionFeedback && (
          <div style={{
            padding: "8px 14px", borderRadius: 10, background: `${t.good}22`,
            border: `1px solid ${t.good}55`, color: t.good, fontSize: 13,
            fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8
          }}>
            <CheckCircle2 size={16} /> {actionFeedback}
          </div>
        )}

        {/* ========================================================
            TAB 1: HEALTH GOALS & AI COACH
        ======================================================== */}
        {sub === "goals" && (
          <div>
            {/* 1. Goal Selector Row */}
            <Card t={t} style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                    <Target size={18} color={t.a1} /> Choose Your Primary Health Goal
                  </div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    Workouts, calorie budgets, and tracking adapt automatically to this objective.
                  </div>
                </div>
                <div style={{
                  padding: "4px 10px", borderRadius: 8, background: `${currentGoalPlan.color}22`,
                  color: currentGoalPlan.color, fontSize: 12, fontWeight: 700, border: `1px solid ${currentGoalPlan.color}44`
                }}>
                  Active: {currentGoalPlan.name}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {Object.entries(GOAL_PLANS).map(([key, plan]) => {
                  const isSelected = selectedGoal === key;
                  const PlanIcon = plan.icon;
                  return (
                    <div
                      key={key}
                      onClick={() => handleGoalSelect(key)}
                      className="press card-hover"
                      style={{
                        padding: "14px", borderRadius: 14, cursor: "pointer",
                        background: isSelected ? t.surface2 : "transparent",
                        border: `2px solid ${isSelected ? plan.color : t.line}`,
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10, background: `${plan.color}22`,
                          display: "flex", alignItems: "center", justifyContent: "center", color: plan.color
                        }}>
                          <PlanIcon size={18} />
                        </div>
                        {isSelected && <Check size={16} color={plan.color} />}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? plan.color : t.text }}>
                        {plan.name}
                      </div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>
                        {plan.badge}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 2. "ARE YOU ACHIEVING YOUR FITNESS GOAL?" DASHBOARD */}
            <Card t={t} style={{ padding: 22, marginBottom: 16, borderColor: `${goalAchievementStatus.color}55` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: t.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                    <Award size={14} color={goalAchievementStatus.color} /> Fitness Goal Achievement Tracker
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: goalAchievementStatus.color, marginTop: 2 }}>
                    {goalAchievementStatus.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: t.muted, marginTop: 2 }}>
                    {goalAchievementStatus.desc}
                  </div>
                </div>

                <div style={{
                  textAlign: "right", background: t.surface2, padding: "8px 16px", borderRadius: 12,
                  border: `1px solid ${t.line}`
                }}>
                  <div style={{ fontSize: 11, color: t.muted }}>Weekly Adherence</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: goalAchievementStatus.color }}>
                    {gymAdherencePct}%
                  </div>
                </div>
              </div>

              {/* Goal Achievement Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
                {/* Gym Time Tracker */}
                <div style={{ background: t.surface2, padding: 14, borderRadius: 12, border: `1px solid ${t.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: t.muted }}>Gym Time This Week</span>
                    <Clock size={14} color={t.a1} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>
                    {totalGymMinsThisWeek} <span style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>/ {currentGoalPlan.targetGymMinsWeek} mins</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: t.surface, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${gymAdherencePct}%`, height: "100%", background: t.a1, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
                    {gymSessionsCount} gym sessions logged in past 7 days
                  </div>
                </div>

                {/* Calorie Goal Tracker */}
                <div style={{ background: t.surface2, padding: 14, borderRadius: 12, border: `1px solid ${t.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: t.muted }}>Daily Calorie Intake</span>
                    <Flame size={14} color={currentGoalPlan.color} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>
                    {todayCalories} <span style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>/ {currentGoalPlan.targetCalories} kcal</span>
                  </div>
                  <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: currentGoalPlan.color, background: `${currentGoalPlan.color}22`, padding: "2px 8px", borderRadius: 6, marginTop: 6 }}>
                    {calorieStatus.badge}
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>
                    {calorieStatus.text}
                  </div>
                </div>

                {/* Protein Goal Tracker */}
                <div style={{ background: t.surface2, padding: 14, borderRadius: 12, border: `1px solid ${t.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: t.muted }}>Target Protein</span>
                    <Scale size={14} color={t.a2} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>
                    ~{bmiData.proteinGrams}g <span style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>/ day</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
                    2.0g per kg of bodyweight to optimize muscular retention & recovery
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. AUTO-SUGGESTED EXERCISES & WORKOUTS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 2px 10px" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={16} color={t.a1} /> Recommended Workouts for {currentGoalPlan.name}
                </div>
                <div style={{ fontSize: 12, color: t.muted }}>
                  {currentGoalPlan.focus}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
              {currentGoalPlan.workouts.map((wk, idx) => (
                <Card t={t} key={idx} style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: currentGoalPlan.color, background: `${currentGoalPlan.color}22`, padding: "2px 8px", borderRadius: 6 }}>
                        {wk.type}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.muted, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {wk.mins} min
                      </span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                      {wk.name}
                    </div>
                    <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.4, marginBottom: 14 }}>
                      {wk.desc}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${t.line}` }}>
                    <button
                      onClick={() => handleQuickLogWorkout(wk)}
                      className="press"
                      style={{
                        flex: 1, padding: "7px 10px", borderRadius: 8, background: t.surface2,
                        border: `1px solid ${t.a1}`, color: t.a1, fontSize: 11.5, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer"
                      }}
                    >
                      <Plus size={13} /> Log Session
                    </button>

                    <button
                      onClick={() => handleQuickScheduleWorkout(wk)}
                      className="press"
                      style={{
                        flex: 1, padding: "7px 10px", borderRadius: 8, background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                        border: "none", color: t.onAccent, fontSize: 11.5, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer"
                      }}
                    >
                      <Clock size={13} /> Schedule
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: WORKOUTS LOG
        ======================================================== */}
        {sub === "workout" && (
          <div>
            <Card t={t} style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>
                Log Custom Workout Session
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  style={{ ...inputStyle(t), flex: 1, minWidth: 200 }}
                  placeholder="Exercise Name (e.g. Chest & Triceps, 5k Run, Legs)"
                  value={exName}
                  onChange={e => setExName(e.target.value)}
                />
                <input
                  style={{ ...inputStyle(t), width: 90 }}
                  placeholder="Minutes"
                  type="number"
                  value={exMin}
                  onChange={e => setExMin(e.target.value)}
                />
                <PrimaryButton t={t} style={{ width: "auto", padding: "10px 18px" }} onClick={logWorkout}>
                  Log Workout
                </PrimaryButton>
              </div>
            </Card>

            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "14px 2px 8px" }}>
              Recent Workout Sessions
            </div>
            {workouts.length === 0 && <Empty t={t} text="No workout sessions recorded yet." />}
            {[...workouts].reverse().map(w => (
              <Card t={t} key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, background: `${t.a2}22`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: t.a2
                  }}>
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{w.name}</div>
                    <div style={{ fontSize: 11.5, color: t.muted }}>{w.date}</div>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.a2 }}>
                  {w.minutes} min
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ========================================================
            TAB 3: DIET & KCAL LOG
        ======================================================== */}
        {sub === "diet" && (
          <div>
            <Card t={t} style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>
                Log Daily Meal & Calorie Intake
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  style={{ ...inputStyle(t), flex: 1, minWidth: 200 }}
                  placeholder="Meal Name (e.g. Scrambled Eggs & Toast, Chicken Bowl)"
                  value={mealName}
                  onChange={e => setMealName(e.target.value)}
                />
                <input
                  style={{ ...inputStyle(t), width: 100 }}
                  placeholder="kcal"
                  type="number"
                  value={mealCal}
                  onChange={e => setMealCal(e.target.value)}
                />
                <PrimaryButton t={t} style={{ width: "auto", padding: "10px 18px" }} onClick={logMeal}>
                  Log Calories
                </PrimaryButton>
              </div>
            </Card>

            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "14px 2px 8px" }}>
              Logged Meals (Today Total: {todayCalories} kcal)
            </div>
            {meals.length === 0 && <Empty t={t} text="No meals logged yet." />}
            {[...meals].reverse().map(m => (
              <Card t={t} key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, background: `${t.a5}22`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: t.a5
                  }}>
                    <Utensils size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: t.muted }}>{m.date}</div>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.a5 }}>
                  {m.cal} kcal
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ========================================================
            TAB 4: BMI & CALCULATOR
        ======================================================== */}
        {sub === "bmi" && (
          <div>
            <Card t={t} style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 14 }}>
                <Scale size={18} color={t.a1} /> Body Metrics & Calculator
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 5 }}>Weight (kg)</div>
                  <input
                    type="number"
                    style={inputStyle(t)}
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="e.g. 72"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 5 }}>Height (cm)</div>
                  <input
                    type="number"
                    style={inputStyle(t)}
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="e.g. 175"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 5 }}>Age</div>
                  <input
                    type="number"
                    style={inputStyle(t)}
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 5 }}>Gender</div>
                  <select style={inputStyle(t)} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 5 }}>Weekly Activity Level</div>
                <select style={inputStyle(t)} value={activity} onChange={e => setActivity(e.target.value)}>
                  <option value="1.2">Sedentary (Little or no exercise)</option>
                  <option value="1.375">Lightly Active (Exercise 1–3 days/week)</option>
                  <option value="1.55">Moderately Active (Exercise 3–5 days/week)</option>
                  <option value="1.725">Very Active (Heavy training 6–7 days/week)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <PrimaryButton t={t} onClick={handleSaveBodyMetrics} style={{ width: "auto", padding: "9px 20px" }}>
                  Save Metrics to Profile
                </PrimaryButton>
                {saveMsg && <div style={{ fontSize: 12, color: t.good, fontWeight: 600 }}>{saveMsg}</div>}
              </div>
            </Card>

            {/* BMI & TDEE Results */}
            {bmiData && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 16 }}>
                <Card t={t} style={{ padding: 20 }}>
                  <div style={{ fontSize: 12, color: t.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Body Mass Index (BMI)</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 10px" }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: bmiData.color }}>
                      {bmiData.bmi}
                    </div>
                    <div style={{
                      padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: `${bmiData.color}22`, color: bmiData.color
                    }}>
                      {bmiData.category}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.4 }}>
                    {bmiData.description}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.muted, marginBottom: 4 }}>
                      <span>Underweight (&lt;18.5)</span>
                      <span>Normal (18.5–24.9)</span>
                      <span>Overweight (25+)</span>
                    </div>
                    <div style={{ height: 8, width: "100%", background: t.surface2, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: "25%", background: t.a2 }} />
                      <div style={{ width: "40%", background: t.good }} />
                      <div style={{ width: "35%", background: t.warm }} />
                    </div>
                  </div>
                </Card>

                <Card t={t} style={{ padding: 20 }}>
                  <div style={{ fontSize: 12, color: t.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Daily Energy Expenditure (TDEE)</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.text, margin: "4px 0 12px" }}>
                    {bmiData.tdee} <span style={{ fontSize: 14, fontWeight: 500, color: t.muted }}>kcal / day</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: t.surface2 }}>
                      <span style={{ fontSize: 12.5, color: t.text, fontWeight: 600 }}>Fat Loss (Cut -500 kcal)</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.good }}>{bmiData.fatLossCalories} kcal</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: t.surface2 }}>
                      <span style={{ fontSize: 12.5, color: t.text, fontWeight: 600 }}>Muscle Gain (Bulk +350 kcal)</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.a1 }}>{bmiData.muscleGainCalories} kcal</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 5: SLEEP
        ======================================================== */}
        {sub === "sleep" && (
          <div>
            <Card t={t} style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 12 }}>
                Average logged: <b style={{ color: t.a2 }}>{avgSleep}h</b> · Aim for 7–8h for physical recovery
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Field t={t} label="Bed time"><input type="time" style={inputStyle(t)} value={bed} onChange={e => setBed(e.target.value)} /></Field>
                <Field t={t} label="Wake time"><input type="time" style={inputStyle(t)} value={wake} onChange={e => setWake(e.target.value)} /></Field>
              </div>
              <PrimaryButton t={t} onClick={logSleep}>Log Last Night's Sleep</PrimaryButton>
            </Card>

            <Card t={t} style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Sleep Trend (Hours)</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleep}>
                    <CartesianGrid stroke={t.line} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, color: t.text }} />
                    <Line type="monotone" dataKey="hours" stroke={t.a1} strokeWidth={2.5} dot={{ r: 3, fill: t.a1 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Page Footer Tagline */}
        <CopyrightFooter t={t} />
      </div>
    </Screen>
  );
}
