
import React, { useState, useEffect, useRef, createContext, useContext } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  saffron:"#FF6B35",gold:"#F4A726",green:"#10B981",blue:"#3B82F6",
  dark:"#0a0a0f",darkGradient:"linear-gradient(135deg,#0a0a0f 0%,#111122 100%)",
  card:"rgba(255,255,255,0.03)",cardLight:"rgba(255,255,255,0.07)",
  text:"#F8FAFC",muted:"#94A3B8",
  purple:"#8B5CF6",pink:"#EC4899",teal:"#14B8A6",red:"#EF4444",
  border:"rgba(255,255,255,0.08)",
};
const glass={background:C.card,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 4px 30px rgba(0,0,0,0.25)"};

// ─── ALL TABS — v37 Brain: Grouped Navigation (40 tabs, 6 categories) ──────────────
const TAB_GROUPS=[
  {
    id:"today", label:"TODAY", icon:"⚡", color:"#FF6B35",
    tabs:[
      {id:"command",   icon:"🚀", label:"Command Center"},
      {id:"myday",     icon:"🗓️", label:"My Day"},
      {id:"onetask",   icon:"🔒", label:"ONE Task"},
      {id:"pomodoro",  icon:"🍅", label:"Pomodoro"},
      {id:"checklist", icon:"✅", label:"Checklist"},
      {id:"countdown", icon:"⏳", label:"Countdown"},
    ]
  },
  {
    id:"study", label:"STUDY", icon:"📚", color:"#10B981",
    tabs:[
      {id:"study",      icon:"📚", label:"Study System"},
      {id:"schedule",   icon:"🌅", label:"Schedule"},
      {id:"mcqtracker", icon:"🎯", label:"MCQ Tracker"},
      {id:"pyqtracker", icon:"📜", label:"PYQ Tracker"},
      {id:"mistakebook",icon:"📖", label:"Mistake Book"},
      {id:"masterplan", icon:"🧠", label:"Master Matrix"},
    ]
  },
  {
    id:"track", label:"TRACK", icon:"📊", color:"#3B82F6",
    tabs:[
      {id:"analytics",   icon:"📈", label:"Analytics"},
      {id:"metrics",     icon:"📐", label:"Metrics"},
      {id:"progress",    icon:"📊", label:"Progress"},
      {id:"scorecard",   icon:"🏆", label:"Scorecard"},
      {id:"habitheatmap",icon:"🔥", label:"Habit Heatmap"},
      {id:"tracker",     icon:"📋", label:"Tracker"},
    ]
  },
  {
    id:"mind", label:"MIND", icon:"🧠", color:"#8B5CF6",
    tabs:[
      {id:"identity",    icon:"👑", label:"Identity"},
      {id:"reflection",  icon:"🪞", label:"Reflection"},
      {id:"ceoreview",   icon:"👔", label:"CEO Review"},
      {id:"selfctrl",    icon:"🧲", label:"Self-Control"},
      {id:"flow",        icon:"🧘", label:"Flow State"},
      {id:"spiritual",   icon:"🕉️", label:"Spiritual"},
    ]
  },
  {
    id:"life", label:"LIFE", icon:"💪", color:"#EC4899",
    tabs:[
      {id:"health",      icon:"💪", label:"Health"},
      {id:"vitality",    icon:"⚡", label:"Vitality"},
      {id:"happiness",   icon:"😊", label:"Happiness"},
      {id:"environment", icon:"🏠", label:"Environment"},
      {id:"community",   icon:"🌍", label:"Community"},
      {id:"money",       icon:"💰", label:"Money"},
    ]
  },
  {
    id:"build", label:"BUILD", icon:"🗂️", color:"#F4A726",
    tabs:[
      {id:"knowledge",  icon:"🗂️", label:"Knowledge"},
      {id:"ideas",      icon:"💡", label:"Ideas"},
      {id:"voicenotes", icon:"🎙️", label:"Voice Hub"},
      {id:"content",    icon:"📆", label:"Content Plan"},
      {id:"digital",    icon:"💻", label:"Digital"},
      {id:"finance",    icon:"🏎️", label:"Mahindra"},
      {id:"storage",    icon:"🗄️", label:"Storage"},
      {id:"quickref",   icon:"📋", label:"Quick Ref"},
      {id:"timeline",   icon:"🕰️", label:"Timeline"},
      {id:"brain",      icon:"🧬", label:"Digital Brain"},
    ]
  },
];
// Flat list for backwards compat (renderTab etc)
const TABS=TAB_GROUPS.flatMap(g=>g.tabs);

// ─── DATA MANAGER v39 — Permanent Persistence Architecture ───────────────────
// Single source of truth. Every read/write goes through DataManager.
// Features: write queue, verification, triple backup, schema migration,
//           auto-save, crash recovery, import/export.

const SCHEMA_VERSION = 3;
const APP_VERSION = "v41";
const PRIMARY_KEY   = "life-os-primary";
const BACKUP_KEY    = "life-os-backup";
const RECOVERY_KEY  = "life-os-recovery";
const META_KEY      = "life-os-meta";
const DAILY_BACKUP_PREFIX   = "autobackup-daily-";
const WEEKLY_BACKUP_PREFIX  = "autobackup-weekly-";
const MONTHLY_BACKUP_PREFIX = "autobackup-monthly-";
const BACKUP_MASTER_KEY     = "backup-master-index";

// ── Raw storage primitives (only DataManager should call these) ───────────────
const _rawGet = async k => {
  try { const r = await window.storage.get(k,false); return r ? JSON.parse(r.value) : null; }
  catch(e) { console.error("[DM:rawGet]",k,e); return null; }
};
const _rawSet = async (k,v) => {
  try { return await window.storage.set(k, JSON.stringify(v), false); }
  catch(e) { console.error("[DM:rawSet]",k,e); return null; }
};
const _rawDel = async k => {
  try { await window.storage.delete(k,false); }
  catch(e) { console.error("[DM:rawDel]",k,e); }
};
const _rawList = async prefix => {
  try { const r = await window.storage.list(prefix,false); return r?.keys||[]; }
  catch(e) { console.error("[DM:rawList]",prefix,e); return []; }
};

// ── Write Queue — serialises concurrent writes, prevents data loss ─────────────
class WriteQueue {
  constructor() { this._q = []; this._running = false; }
  async enqueue(fn) {
    return new Promise((resolve,reject) => {
      this._q.push({fn,resolve,reject});
      if(!this._running) this._drain();
    });
  }
  async _drain() {
    this._running = true;
    while(this._q.length > 0) {
      const {fn,resolve,reject} = this._q.shift();
      try { resolve(await fn()); } catch(e) { reject(e); }
    }
    this._running = false;
  }
}

// ── Schema migration ──────────────────────────────────────────────────────────
function migrateData(raw, fromVersion) {
  let d = raw;
  // v1 → v2: no structural change, just version bump
  if(fromVersion < 2) { d = {...d, _migrated_v2: true}; }
  // v2 → v3: add storage metadata fields
  if(fromVersion < 3) { d = {...d, _migrated_v3: true, _storageArch: "v41"}; }
  return d;
}

// ── BackupEngine — automatic timed backups ────────────────────────────────────
const BackupEngine = (() => {
  const _now = () => new Date().toISOString();
  const todayStr2 = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const weekStr2  = () => { const d=new Date();const dow=(d.getDay()+6)%7;const mon=new Date(d);mon.setDate(d.getDate()-dow);return`${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`; };
  const monthStr2 = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };

  const _wrap = (data, type, label) => ({
    backupId: "bk-"+ Date.now()+"-"+Math.random().toString(36).slice(2,6),
    type, label,
    ts: Date.now(),
    date: todayStr2(),
    week: weekStr2(),
    month: monthStr2(),
    year: new Date().getFullYear(),
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    data,
  });

  const _indexAdd = async (meta) => {
    try {
      const idx = (await _rawGet(BACKUP_MASTER_KEY)) || [];
      idx.unshift(meta);
      if(idx.length > 500) idx.length = 500; // keep max 500 index entries
      await _rawSet(BACKUP_MASTER_KEY, idx);
    } catch(e) { console.error("[BackupEngine:index]", e); }
  };

  return {
    // Auto daily backup — runs once per day, never overwrites
    async dailyBackup(data) {
      try {
        const key = DAILY_BACKUP_PREFIX + todayStr2();
        const existing = await _rawGet(key);
        if(existing) return null; // already backed up today
        const entry = _wrap(data, "daily", "Daily Backup " + todayStr2());
        await _rawSet(key, entry);
        await _indexAdd({backupId:entry.backupId,type:"daily",date:entry.date,ts:entry.ts,key,label:entry.label});
        console.info("[BackupEngine] daily backup saved:", key);
        return entry.backupId;
      } catch(e) { console.error("[BackupEngine:daily]",e); return null; }
    },

    // Auto weekly backup — once per week
    async weeklyBackup(data) {
      try {
        const key = WEEKLY_BACKUP_PREFIX + weekStr2();
        const existing = await _rawGet(key);
        if(existing) return null;
        const entry = _wrap(data, "weekly", "Weekly Backup w/" + weekStr2());
        await _rawSet(key, entry);
        await _indexAdd({backupId:entry.backupId,type:"weekly",date:entry.date,ts:entry.ts,key,label:entry.label});
        return entry.backupId;
      } catch(e) { console.error("[BackupEngine:weekly]",e); return null; }
    },

    // Auto monthly backup — once per month
    async monthlyBackup(data) {
      try {
        const key = MONTHLY_BACKUP_PREFIX + monthStr2();
        const existing = await _rawGet(key);
        if(existing) return null;
        const entry = _wrap(data, "monthly", "Monthly Backup " + monthStr2());
        await _rawSet(key, entry);
        await _indexAdd({backupId:entry.backupId,type:"monthly",date:entry.date,ts:entry.ts,key,label:entry.label});
        return entry.backupId;
      } catch(e) { console.error("[BackupEngine:monthly]",e); return null; }
    },

    // Emergency backup — call before any risky operation
    async emergencyBackup(data, reason) {
      try {
        const key = "autobackup-emergency-" + Date.now();
        const entry = _wrap(data, "emergency", "Emergency: " + (reason||"pre-op"));
        await _rawSet(key, entry);
        await _indexAdd({backupId:entry.backupId,type:"emergency",date:entry.date,ts:entry.ts,key,label:entry.label});
        return entry.backupId;
      } catch(e) { console.error("[BackupEngine:emergency]",e); return null; }
    },

    // Manual named backup
    async manualBackup(data, name) {
      try {
        const key = "autobackup-manual-" + Date.now();
        const entry = _wrap(data, "manual", name || ("Manual Backup " + new Date().toLocaleString()));
        await _rawSet(key, entry);
        await _indexAdd({backupId:entry.backupId,type:"manual",date:entry.date,ts:entry.ts,key,label:entry.label});
        return entry.backupId;
      } catch(e) { console.error("[BackupEngine:manual]",e); return null; }
    },

    async getIndex() {
      try { return (await _rawGet(BACKUP_MASTER_KEY)) || []; }
      catch(e) { return []; }
    },

    async loadBackup(key) {
      try { return await _rawGet(key); }
      catch(e) { return null; }
    },

    async runAutoBackups(data) {
      await this.dailyBackup(data);
      await this.weeklyBackup(data);
      await this.monthlyBackup(data);
    },
  };
})();

// ── DataIntegrityChecker ──────────────────────────────────────────────────────
const DataIntegrityChecker = {
  async check() {
    const issues = [];
    try {
      const primary = await _rawGet(PRIMARY_KEY);
      const backup  = await _rawGet(BACKUP_KEY);
      const recovery= await _rawGet(RECOVERY_KEY);

      if(!primary?.data) issues.push({level:"critical", msg:"Primary storage missing or corrupt"});
      if(!backup?.data)  issues.push({level:"warning",  msg:"Backup copy missing — resave to fix"});
      if(!recovery?.data) issues.push({level:"info",    msg:"Recovery copy missing — will auto-fix on next save"});

      // Schema version check
      if(primary?.schemaVersion && primary.schemaVersion < SCHEMA_VERSION) {
        issues.push({level:"info", msg:`Schema migration pending: v${primary.schemaVersion} → v${SCHEMA_VERSION}`});
      }

      // Cross-check primary vs backup
      if(primary?.data && backup?.data) {
        const pKeys = Object.keys(primary.data||{}).length;
        const bKeys = Object.keys(backup.data||{}).length;
        if(Math.abs(pKeys - bKeys) > 10) {
          issues.push({level:"warning", msg:`Primary (${pKeys} keys) vs Backup (${bKeys} keys) mismatch — consider emergency backup`});
        }
      }
    } catch(e) {
      issues.push({level:"critical", msg:"Integrity check failed: " + e.message});
    }
    return issues;
  }
};

// ── DataManager singleton ─────────────────────────────────────────────────────
const DataManager = (() => {
  let _cache = null;        // current live data (UI cache only)
  let _status = "idle";     // "idle"|"saving"|"saved"|"error"
  let _listeners = [];
  const _q = new WriteQueue();
  const _now = () => new Date().toISOString();

  // Notify UI of status change
  const _notify = (status, data) => {
    _status = status;
    _listeners.forEach(fn => fn({status, data: data || _cache}));
  };

  // Verify round-trip: write → read back → compare
  const _verify = async (key, expected) => {
    try {
      const readBack = await _rawGet(key);
      // Compare core fields (not metadata timestamps)
      const eStr = JSON.stringify(expected);
      const rStr = JSON.stringify(readBack);
      return eStr === rStr;
    } catch { return false; }
  };

  // Write with verification + retry
  const _writeVerified = async (key, value, retries=3) => {
    for(let i=0; i<retries; i++) {
      await _rawSet(key, value);
      const ok = await _verify(key, value);
      if(ok) return true;
      console.warn(`[DM] verify failed on ${key}, retry ${i+1}`);
    }
    console.error(`[DM] write failed after ${retries} retries on ${key}`);
    return false;
  };

  // Wrap data with metadata envelope
  const _wrap = (data) => ({
    data,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    migrationVersion: SCHEMA_VERSION,
    modifiedAt: _now(),
    createdAt: (_cache?._meta?.createdAt) || _now(),
  });

  return {
    // ── Subscribe to state changes ──────────────────────────────────────────
    subscribe(fn) { _listeners.push(fn); return () => { _listeners = _listeners.filter(l=>l!==fn); }; },
    get status() { return _status; },
    get cache() { return _cache; },

    // ── Boot: load, validate, migrate, restore ──────────────────────────────
    async boot() {
      _notify("loading");
      let loaded = null;
      let source = "none";

      // Try primary
      const primary = await _rawGet(PRIMARY_KEY);
      if(primary?.data) { loaded = primary; source = "primary"; }

      // Try backup if primary failed or is corrupt
      if(!loaded || !loaded.data) {
        console.warn("[DM] primary failed, trying backup");
        const backup = await _rawGet(BACKUP_KEY);
        if(backup?.data) { loaded = backup; source = "backup"; }
      }

      // Try recovery copy
      if(!loaded || !loaded.data) {
        console.warn("[DM] backup failed, trying recovery");
        const recovery = await _rawGet(RECOVERY_KEY);
        if(recovery?.data) { loaded = recovery; source = "recovery"; }
      }

      if(!loaded) {
        console.warn("[DM] no stored data found — starting fresh");
        _cache = null;
        _notify("fresh");
        return null;
      }

      // Schema migration
      const fromVersion = loaded.schemaVersion || 1;
      let userData = loaded.data;
      if(fromVersion < SCHEMA_VERSION) {
        console.info(`[DM] migrating schema v${fromVersion} → v${SCHEMA_VERSION}`);
        userData = migrateData(userData, fromVersion);
        // Save migrated data back
        await this.save(userData);
      }

      _cache = userData;
      console.info(`[DM] booted from ${source}, schema v${fromVersion}`);

      // Update meta
      await _rawSet(META_KEY, {
        lastBoot: _now(),
        source,
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
      });

      // Restore navigation state
      const nav = await _rawGet("v41-nav") || await _rawGet("v39-nav");

      _notify("loaded", userData);
      return { data: userData, nav };
    },

    // ── Save: queue → validate → write primary → backup → recovery → verify ──
    async save(data) {
      return _q.enqueue(async () => {
        _notify("saving");
        const envelope = _wrap(data);

        // Write primary
        const primaryOk = await _writeVerified(PRIMARY_KEY, envelope);

        // Always write backup (even if primary failed)
        await _rawSet(BACKUP_KEY, envelope);

        // Write recovery (best-effort, don't block on verify)
        await _rawSet(RECOVERY_KEY, envelope);

        if(!primaryOk) {
          _notify("error");
          console.error("[DM] primary write verification failed — data in backup");
        } else {
          _cache = data;
          _notify("saved", data);
        }

        return primaryOk;
      });
    },

    // ── Patch: update a field path, then save ──────────────────────────────
    async patch(path, value, currentData) {
      let updated;
      if(path.includes(".")) {
        const [parent, child] = path.split(".");
        updated = { ...currentData, [parent]: { ...(currentData[parent]||{}), [child]: value } };
      } else {
        updated = { ...currentData, [path]: value };
      }
      await this.save(updated);
      return updated;
    },

    // ── Nav save / load ────────────────────────────────────────────────────
    async saveNav(tab, group) {
      await _rawSet("v41-nav", { tab, group, ts: _now() });
    },
    async loadNav() {
      return _rawGet("v41-nav") || _rawGet("v39-nav");
    },

    // ── Export full database as JSON ───────────────────────────────────────
    async exportFull(data, label="") {
      const keys = await _rawList("");
      const allData = {};
      for(const k of keys) {
        try { allData[k] = await _rawGet(k); } catch {}
      }
      return {
        exportedAt: _now(),
        exportVersion: APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        label: label || "Full Export",
        workspace: data,
        allKeys: allData,
      };
    },

    // ── Import: merge into primary ─────────────────────────────────────────
    async importData(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        const importData = parsed.workspace || parsed.data || parsed;
        // Merge: imported data fills gaps, existing data takes priority
        const merged = { ...(importData||{}), ...(_cache||{}) };
        await this.save(merged);
        return { ok: true, merged };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    },

    // ── Meta info ─────────────────────────────────────────────────────────
    async getMeta() { return _rawGet(META_KEY); },

    // ── Integrity check (delegates to DataIntegrityChecker) ──────────────
    async checkIntegrity() { return DataIntegrityChecker.check(); },

    // ── Run auto backups (daily/weekly/monthly) ───────────────────────────
    async runAutoBackups(data) { return BackupEngine.runAutoBackups(data); },
    async manualBackup(data, name) { return BackupEngine.manualBackup(data, name); },
    async emergencyBackup(data, reason) { return BackupEngine.emergencyBackup(data, reason); },
    async getBackupIndex() { return BackupEngine.getIndex(); },
    async loadBackup(key) { return BackupEngine.loadBackup(key); },

    // ── Direct key access (for modules using their own keys) ──────────────
    get: _rawGet,
    set: _rawSet,
    del: _rawDel,
    list: _rawList,
  };
})();

// ─── STORAGE HELPERS (delegated to DataManager) ───────────────────────────────
// All module-level storage still goes through these — now DataManager-backed
const stGet = async k => DataManager.get(k);
const stSet = async (k,v) => DataManager.set(k,v);
const stList = async p => DataManager.list(p);
const stDel = async k => DataManager.del(k);


// ─── MONTHLY RECORD HELPERS ───────────────────────────────────────────────────
function monthKey(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function weekKey(){const d=new Date();const dow=(d.getDay()+6)%7;const mon=new Date(d);mon.setDate(d.getDate()-dow);return`${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;}

// ─── DAILY ARCHIVE HELPERS ────────────────────────────────────────────────────
// Every save also writes a dated snapshot so any past day can be reopened later.
const ARCHIVE_FULL_PREFIX="archivefull-";
const ARCHIVE_TAB_PREFIX="archivetab-";
const archiveFullKey=d=>`${ARCHIVE_FULL_PREFIX}${d}`;
const archiveTabKey=(t,d)=>`${ARCHIVE_TAB_PREFIX}${t}-${d}`;

// ─── EDIT CONTEXT ─────────────────────────────────────────────────────────────
const EC=createContext({em:false,data:{},set:()=>{},tab:"",archiveTabNow:()=>{},restoreAll:()=>{},restoreTab:()=>{}});
const useEC=()=>useContext(EC);

// ─── FULL DEFAULTS ────────────────────────────────────────────────────────────
const DEF={
  // IDENTITY
  identityStatement:"Main yoga trainer haan.\nMain disciplined aspirant haan.\nMain Nishkam Karam karda haan.\nMera pehla mission ADO + Patwari + AFO Selection hai.\nHar roz meri routine meri selection, sehat, character, te future nu mazboot karegi.",
  morningAffirmation:"Main aaj sirf ONE task te full focus karaanga. Mera karam mere haath, phal prabhu de haath.",
  eveningAffirmation:"Aaj jo bhi hoya, theek hoya. Kal fir behtar karaanga. All Is Well.",
  priorities:["🎯 ADO + Patwari + AFO Selection","💪 Health & Recovery","❤️ Me Time","🎥 YouTube (only after exam tasks done)","💻 Skill (only after exam tasks done)","🎮 Entertainment"],
  philosophyCodes:["Only I can change my life. No one else can do it for me.","Champion = Recovery after failure. Resilience defines identity.","Don't wait for perfect time. Execution starts exactly where you are.","Best preparation for tomorrow = Best work today.","If it doesn't challenge you, it won't change you.","Work for a cause, not applause. Let results make the noise.","Express, don't impress. Stay transparent and honest.","Everything happens for betterment. Trust the process.","Life is a gift. Celebrate it with unshakeable discipline.","Keep growing without fear. Fear is illusion; progress is real.","Focus on today. Live strictly in the present moment.","All Is Well. Clear mind, calm soul, absolute focus."],
  lifeVision:[
    {icon:"💵",label:"Paisa",sub:"₹50,000 Min Salary Target",color:"#F4A726"},
    {icon:"🧘",label:"Healthy Fit",sub:"Body + Mind peak condition",color:"#10B981"},
    {icon:"🌸",label:"Happy",sub:"Calm + Clear mindset",color:"#EC4899"},
    {icon:"👑",label:"Character",sub:"Strong + Honest identity",color:"#FF6B35"},
    {icon:"🌾",label:"Sewa Work",sub:"Yoga + Community service",color:"#3B82F6"},
  ],
  mindsetRules:[
    {icon:"⚓",title:"Discipline Over Motivation",detail:"Routine permanent hai. 3 AM = table pe baith jao."},
    {icon:"🎯",title:"Done > Perfect",detail:"Perfectionism = procrastination. Concept done → Next."},
    {icon:"📊",title:"80/20 Matrix",detail:"Core 20% topics = 80% marks. PYQs anchor high-yield topics."},
    {icon:"🔄",title:"Never Miss Twice",detail:"2 consecutive miss = bad habit birth. Bounce back instantly."},
    {icon:"🔋",title:"Recovery is Productive",detail:"Nap + Yoga Nidra = high performance. Never skip recovery."},
    {icon:"⏳",title:"Parkinson's Law",detail:"Last 30 days = hard deadlines per topic. No open-ended study."},
    {icon:"🎯",title:"Single Task Focus",detail:"Ik time te ik hi kaam. Stress-free morning = one fixed task."},
    {icon:"📵",title:"Zero Digital Pollution",detail:"Phone OFF until morning study ends. First dopamine from subject mastery, not scrolling."},
    {icon:"🛡️",title:"Comparison Kills Focus",detail:"Sirf yesterday-self se compare karo. Doojeya de profiles scan karna artificial anxiety hai."},
    {icon:"🧱",title:"Fixed Structure > Random Actions",detail:"Schedule deewar te chipkao. Subjects randomly shift karna = strictly banned."},
    {icon:"🧭",title:"Focus on Controllables",detail:"Exam rumors, board shifts — ignore. Focus: agriculture notes + math solutions."},
    {icon:"📈",title:"Target-Based Study",detail:"Hours count illusion hai. Count: topics done, MCQs solved, Anki cards created."},
  ],
  thugs:[
    {thug:"Mobile Check at 3 AM",trap:"\"Bas 2 minute WhatsApp\"",result:"20 min wasted",rule:"Study Block 1 tak social media band"},
    {thug:"YouTube as Fake Study",trap:"\"Strategy videos dekh reha haan\"",result:"Study = 0",rule:"Study > Notes > MCQs first"},
    {thug:"Overplanning",trap:"Roz nava timetable banana",result:"No execution",rule:"Monthly review only, daily sirf follow"},
    {thug:"Perfectionism",trap:"\"Sab perfect hove fir start\"",result:"Delay, no action",rule:"Done > Perfect"},
    {thug:"Nap Overrun",trap:"Alarm snooze",result:"Evening study gayi",rule:"90 min fixed, hard stop"},
    {thug:"Night Screen Time",trap:"Reels before sleep",result:"Sleep quality down",rule:"9 PM baad reels nahi"},
    {thug:"Missing MCQs",trap:"Sirf reading",result:"Exam performance weak",rule:"Roz MCQs — non-negotiable"},
    {thug:"Weekend Waste",trap:"Mon-Fri discipline, weekend loose",result:"Most dangerous",rule:"Same wake-up time always"},
    {thug:"Single Subject Overdose",trap:"Ik subject vich din kadna",result:"Sectional cutoffs miss",rule:"Daily rotation fixed"},
    {thug:"Dopamine Overstimulation",trap:"Reels/scroll before study — \"bas 5 min\"",result:"Frontal lobe weakens, self-control drops for the whole day",rule:"See Self-Control tab → Create Distance Rule. Phone duur, study first."},
    {thug:"Too Many Skills",trap:"AI+Canva+Excel+Editing ikathe",result:"Kise vich mastery nahi",rule:"One skill at a time — no jumping"},
    {thug:"Chasing Every Exam",trap:"Patwari+ADO+10 hor exams simultaneously",result:"Focus divide, kuch nahi hunda",rule:"Main target clear rakho — ADO+Patwari+AFO only"},
    {thug:"Emotional Distractions",trap:"Chats, crush, unnecessary drama",result:"Energy + focus leak",rule:"Chat = reward, not replacement. Target first, fir chatting"},
    {thug:"Health Optimization Addiction",trap:"New supplements/biohacks weekly",result:"Study time kha janda hai",rule:"Simple food + sleep + yoga + running"},
  ],
  eliminationMatrix:["Vehra (Procrastination / Unproductive Sitting) — poori tarah khatam!","Money & Job Fear — poori tarah khatam!","Inconsistency from roots — poori tarah khatam!"],
  antiThugRules:["❌ No Overplanning","❌ No Productivity Addiction","❌ No Random Reels","❌ No Perfectionism","❌ No Exam Hopping","❌ No Late Night Scrolling","❌ No Missing Same Habit Twice","❌ No One Subject Overdose"],
  goldenQuestions:["Aaj 6 hr study hoi?","Aaj sleep schedule follow hoya?","Aaj phone ne mainu control kita ya main phone nu?"],
  goldenRuleNote:"Je 3 vicho 2 positive ne → sahi direction vich ja reha hai.",
  backupPlans:[
    {trigger:"Woke up late (missed 3 AM)",plan:"Compress Study Block 1 to highest-yield only: Agriculture MCQs + Punjab GK. Skip new learning, do it in class gaps instead."},
    {trigger:"No class gaps today",plan:"Anki + CA shift to evening. Don't skip — relocate."},
    {trigger:"Sick / low energy",plan:"Emergency Min: 20 MCQs + 10 min Anki + Meditation + Sleep. No guilt."},
    {trigger:"Unexpected event ate evening block",plan:"Protect Quant + Agriculture only (highest weightage). Reasoning/English/Computer shift to next day's gaps."},
    {trigger:"Mock score badly affects mood",plan:"No same-day deep analysis. Quick scan only, sleep on time, analyze fresh next morning."},
  ],
  selfControlRules:[
    {icon:"🎯",title:"Bolo Mat, Bano",detail:"Har task ko ek clear TRIGGER naal jodo. Alarm bajdi → table. Koi debate nahi."},
    {icon:"🧘",title:"Create Distance",detail:"Feelings aur reaction de beech gap banao. Phone uthana chahunda? 10 sec wait."},
    {icon:"🔄",title:"Excuse Repeat Mat Karo",detail:"Ik baar chook gayi → thik. Par wahi dobara = system failure."},
    {icon:"🏗️",title:"Environment Design",detail:"Books raat nu ready, phone duur, study table set. 3 AM te 0 friction."},
  ],
  // SCHEDULE
  schedule:[
    {time:"3:00 AM",activity:"Wake Up",detail:"2 Glasses Copper Water pi ke uth jao. Alarm label: 'ADO chahida ya 3 hor saal?' — no snooze, no negotiation.",color:C.purple},
    {time:"3:02–3:07",activity:"Nishkam Karma",detail:"Karam te adhikar, phal te nahi",color:C.purple},
    {time:"3:07–3:15",activity:"Running",detail:"Spot Jog / Brisk Run — blood flow tej karo, brain activate karo for deep study.",color:C.purple},
    {time:"3:15–3:25",activity:"Meditation + Breathing",detail:"Belly → Ribs → Chest",color:C.purple},
    {time:"3:25–3:27",activity:"Pre-Study Ritual",detail:"5 Deep Breaths + Sankalp + Visualize Selection + Today's ONE task fix karo. Phone silent. Deep work mode ON.",color:C.purple},
    {time:"3:27–4:10",activity:"🌾 Agriculture — New Learning",detail:"Deep Study. Hardest topic pehle. Zero phone interference. ONE topic at a time only. Use Feynman + notes.",color:C.green},
    {time:"4:10–4:35",activity:"🌾 Agriculture MCQs",detail:"Padhe hoye topic di validation. Rough paper pe solve karo — NOT just reading options.",color:C.green},
    {time:"4:35–5:05",activity:"Punjab GK + Current Affairs",detail:"Learn + Active Recall. Exam-relevant only. 1-liner own words for CA.",color:C.green},
    {time:"5:05–5:15",activity:"Bath + Datun",detail:"Datun/brush, freshen up — full hygiene reset. Cold/lukewarm water preferred.",color:C.saffron},
    {time:"5:15–5:25",activity:"Breakfast",detail:"Milk/Curd + Besan item + Fruit (Sattvic energy fuel — no heavy fried food).",color:C.saffron},
    {time:"5:25–5:35",activity:"Ready + Leave",detail:"Kit pack, Tilak, Vastra Dharan",color:C.saffron},
    {time:"5:35–2:00 PM",activity:"CM Yogshala",detail:"Classes + Travel. Breaks: Kegel (5m) + Anki (5m) × 2. Last 3-5 min/class = 2-3 new Anki cards. Water every 60-90 min + 2-3 min walk jadon mauka mile.",color:C.gold},
    {time:"9:00–10:00 AM",activity:"Snack",detail:"Chana + Peanuts — energy level up. No heavy food during class.",color:C.gold},
    {time:"2:00–2:15 PM",activity:"Lunch",detail:"Dal + Sabzi + Roti + Salad + Curd (50-25-25 rule). No heavy eating.",color:C.blue},
    {time:"2:15–2:30 PM",activity:"Me Time ❤️",detail:"Family / Music / Tea — zero guilt relaxation. Recharge before nap.",color:C.blue},
    {time:"2:30–4:00",activity:"😴 Nap (Yoga Nidra)",detail:"90 Min deep recovery.",color:C.blue},
    {time:"4:00–4:10",activity:"Bath + Reset",detail:"Muh dho, fresh ho jao for evening study block.",color:C.blue},
    {time:"4:10–4:25",activity:"Deep Breathing + Meditation",detail:"Belly→Ribs→Chest + 10 min reset meditation — Ida Nadi optional.",color:C.blue},
    {time:"4:25–4:30",activity:"Fruit + Strength",detail:"Fruit khao + Pushups / Squats / Plank (body activation before study).",color:C.blue},
    {time:"4:30–5:30",activity:"📊 Quant",detail:"Concepts + MCQs on rough paper.",color:C.green},
    {time:"5:30–6:00",activity:"🧩 Reasoning",detail:"Concepts + Timed MCQs",color:C.green},
    {time:"6:00–6:30",activity:"📖 English",detail:"Grammar + Vocab + RC passages",color:C.green},
    {time:"6:30–6:50",activity:"💻 Computer (ICT)",detail:"Concepts + MCQs",color:C.green},
    {time:"6:50–7:30",activity:"Punjab GK Revision + MCQs",detail:"Recall. No new content.",color:C.green},
    {time:"7:30–7:40",activity:"🌅 Sunset Walk",detail:"Observe sunset. Mindful walk. Calm down. 2-5 min direct eye exposure to sunset light.",color:C.teal},
    {time:"7:40–8:00",activity:"Me Time ❤️",detail:"Relax. Zero academic guilt. Kabhi-kabhi: Mandir visit is slot.",color:C.teal},
    {time:"8:00–8:30",activity:"YouTube + Skill",detail:"ONLY if all exam tasks done.",color:C.teal},
    {time:"8:30–9:00",activity:"Dinner",detail:"Light meal. 50-25-25 rule.",color:C.blue},
    {time:"9:00–9:05",activity:"Planning + Journal",detail:"Tomorrow ka ONE main task fix karo. Table reset. Books set. Tomorrow = 0 friction.",color:C.purple},
    {time:"9:05–9:10",activity:"📿 Geeta — 1 Page",detail:"Daily 1 page padho. Nishkam Karma de roots isse hi aande ne.",color:C.gold},
    {time:"9:10–9:18",activity:"Night Meditation",detail:"Med 2 (8 min) — deep sleep preparation. Belly breathing focus.",color:C.purple},
    {time:"9:18–9:25",activity:"🌙 Ida Nadi Activation",detail:"Left-side lie down OR Nadi Shodhana (right nostril closed, left-only breathing) — calms brain, preps deep sleep.",color:C.purple},
    {time:"9:25–9:28",activity:"Gratitude + Affirmations",detail:"Positive programming. Thank the universe. Evening affirmation repeat.",color:C.purple},
    {time:"9:28–9:30",activity:"Sleep Prep",detail:"Phone OFF. Eye mask + earplugs. Head North/East. Left-side posture locked in.",color:C.purple},
    {time:"9:30 PM",activity:"💤 Sleep",detail:"6.5h deep cellular repair. Left side posture. No stomach sleeping.",color:C.purple},
  ],
  subjectAlloc:[
    {label:"🌾 Agriculture",time:"1h 13m",note:"Morning deep learning (43min) + MCQs (25min). Hardest topic first.",color:C.green},
    {label:"🏛️ Punjab GK + CA",time:"55m",note:"Morning new + Evening revision",color:C.purple},
    {label:"📊 Quant",time:"1h",note:"Concepts (30m) + 43-21 MCQs on rough paper. Math = solve, not read.",color:C.gold},
    {label:"🧩 Reasoning",time:"30m",note:"Concepts + Timed MCQs",color:C.blue},
    {label:"📖 English",time:"30m",note:"Grammar + Vocab + RC",color:C.pink},
    {label:"💻 Computer",time:"20m",note:"High Patwari weightage ⚠️",color:C.saffron},
    {label:"🎴 Anki (portable)",time:"20-30m",note:"Class breaks",color:"#FF5722"},
    {label:"🎥 YouTube + Skill",time:"30m conditional",note:"Only after all exam tasks done",color:C.teal},
  ],
  // STUDY SYSTEM
  studyFramework:["Big Picture","Topic Breakdown","Keyword Notes","Detailed Study","Question Yourself","Active Recall","Write From Memory","MCQs","PYQs","Flashcards","1 Page Notes","Teach Wall","Voice Note","Revision Sheet"],
  examFinalPhase:[
    {rule:"5x Revision Before Exam",detail:"Har core topic min 5 vaar: read + write + recall mix"},
    {rule:"Parkinson's Law (Last 30 Days)",detail:"Har topic hard deadline. Open-ended study = banned."},
    {rule:"30% Recovery Rule",detail:"Mixed mock score down: agle din 30% extra on weak area"},
  ],
  afoPrelims:["Static + Current Agriculture: agronomy, soil, animal husbandry, horticulture, NABARD schemes","Mock tests regularly — speed + accuracy both","Tough Q = skip, return if time left"],
  afoMains:["PYQs deeply analyze — topic weightage + pattern","English typing practice — computer-based exam","Strict time management — all sections attempted"],
  agriChecklist:["Lecture watched","Detailed Notes made","Short Notes condensed","Active Recall done","MCQs practiced","PYQs analyzed","Voice Notes recorded","Revision Sheet ready"],
  memoryMethods:[
    {method:"Feynman Technique",use:"Teach the wall — explain out loud"},
    {method:"Story Method",use:"Funny/emotional stories per topic"},
    {method:"Memory Palace",use:"Home/Village/College route mapping"},
    {method:"Keyword Linking",use:"New info hook onto existing knowledge"},
    {method:"Mnemonics",use:"Weird + visual + emotional shortcuts"},
  ],
  revisionTargets:[
    {subject:"Agriculture",target:""},
    {subject:"Quant",target:""},
    {subject:"Reasoning",target:""},
    {subject:"English",target:""},
    {subject:"Computer",target:""},
    {subject:"Punjab GK",target:""},
    {subject:"Current Affairs",target:""},
  ],
  preStudyRitual:["5 Deep Breaths","Sankalp","Visualize Selection","Open Mind Map","Identify Keywords","Set Target","Phone Silent","Deep Work Start"],
  pomodoroProtocol:[
    {mode:"Deep (Agriculture, Quant new)",rule:"50 min focus → 10 min break"},
    {mode:"Lighter (MCQs, Revision, GK)",rule:"25 min focus → 5 min break"},
    {mode:"Break Rule",rule:"Water, stand, stretch — NO phone during break"},
    {mode:"Overdo Guard",rule:"After 2 Pomodoros same subject → forced switch"},
  ],
  studyHacks:[
    {hack:"Topic-End Teach",detail:"Har topic khatam: deewar nu explain karo (Teach Wall)"},
    {hack:"Finger/Stylus Fast Revision",detail:"Notes te fast scan — 2-3 sec per line"},
    {hack:"Sectional Tests",detail:"Har major topic baad sectional test zaroor do"},
    {hack:"Separate Short-Notes Copy",detail:"Ultra-condensed 1-liners — final revision layi"},
    {hack:"PYQ + Mistake Book",detail:"Ik copy vich PYQs + mistakes dono record karo — exam ton pehle sab ton zaroori"},
    {hack:"Write-by-Deadline Revision",detail:"Likh ke karo, padh ke nahi — Parkinson's Law se bachao"},
    {hack:"Emotion-Tagged Notes",detail:"Mushkil topics te emoji/music tag — emotional anchor"},
    {hack:"Gamify Daily Targets",detail:"Kal de score nu beat karna — self-competition"},
    {hack:"Sidhasana for Short Tasks",detail:"Chhote focused tasks (Anki, quick revision) Sidhasana vich karo — spine seedhi, focus tight"},
    {hack:"Buffer Zone (Daily)",detail:"Roz 15-20 min unscheduled buffer rakho kisi bhi overflow layi — schedule break nahi hounda"},
    {hack:"Click/Note Reminders",detail:"Important cheez turant ik-line note ya phone reminder — baad vich bhul jaan ton bachao"},
    {hack:"Summary Sheet Post-Study",detail:"Har study session khatam hon baad ik quick-reference summary sheet banao — final week ch eh hi padhna hove"},
    {hack:"Cross-Disciplinary Linking",detail:"Agriculture ke concepts ko GK/Current Affairs naal jodo (e.g. govt scheme + crop) — dual-subject recall strengthen hounda"},
    {hack:"Instrumental Study Playlist",detail:"Lyrics-free instrumental music background ch chalao deep-focus blocks layi — lyrics distraction create karde"},
    {hack:"Visual Aids + Diagrams",detail:"Process-based topics (crop cycles, schemes flow) diagram bana ke yaad rakho — text se zyada sticky"},
    {hack:"Milestone Reward System",detail:"Har major milestone (100 MCQs, topic complete, weekly target) te chhota self-reward fix karo — guilt-free, pre-decided"},
    {hack:"Dedicated Review & Summarize Block",detail:"Plain revision ton vakhra ik condense step rakho — notes nu summary form vich rewrite karo, sirf re-read nahi"},
    {hack:"Quant Fundamentals Refresh",detail:"New-concept Quant ton vakhra — tables, squares, cubes, percentages jaise base fundamentals nu apna recurring revision category banao"},
    {hack:"Peer/Group Discussion",detail:"Kabhi-kabhi ik mushkil topic kise dost naal discuss karo — explaining + listening dono naal angles clear hounde"},
    {hack:"Post-Nap Recap (Distinct Step)",detail:"Nap ke baad, naye topic shuru karan ton pehle morning session de notes nu apne words vich dobara likho. Eh transition smooth banaunda te memory consolidate karda"},
  ],
  ankiRules:[
    {rule:"Card Creation",detail:"1 Concept = 1 Card. No paragraph cards."},
    {rule:"Cloze Deletion",detail:"Formulas/dates → Fill-in-the-blank"},
    {rule:"Formula",detail:"Question → Answer → Real Example"},
    {rule:"Review Timing",detail:"Class breaks or pre-lunch"},
    {rule:"Priority",detail:"Weak topics pehle always"},
  ],
  afoTips:[
    {tip:"Self-Study Foundation",detail:"Coaching helps but self-study = real foundation"},
    {tip:"Neglected Subjects Coverage",detail:"Forestry te Sericulture jaise kam-padhe subjects nu vi poora time deo — eh exact thaan hai jithe toppers extra marks kadde ne"},
    {tip:"Reasoning Start Point",detail:"Inequality, Syllogism, Blood Relations — eh teen topics pehle master karo, fir puzzles/seating arrangement"},
    {tip:"Major Crops Deep Dive",detail:"Major fruits + vegetables jo exams vich baar-baar puchhe jaande — dedicated reference book se in-depth coverage karo"},
    {tip:"Puzzle Recall Hack",detail:"Puzzles + seating arrangement story ya keyword banake yaad rakho — raw logic se zyada effective"},
    {tip:"Quant Priority",detail:"Arithmetic + DI — highest weightage, max MCQ reps"},
    {tip:"Overlap Strategy",detail:"Patwari+ADO+AFO overlap — same study, 3 shots"},
  ],
  subjectRatios:[
    {subject:"🌾 Agriculture",n:45,m:30,r:25},
    {subject:"🏛️ Punjab GK",n:20,m:40,r:40},
    {subject:"📰 Current Affairs",n:30,m:30,r:40},
    {subject:"📊 Quant",n:30,m:70,r:0},
    {subject:"🧩 Reasoning",n:20,m:80,r:0},
    {subject:"📖 English",n:30,m:70,r:0},
    {subject:"💻 Computer",n:40,m:60,r:0},
  ],
  // HEALTH + VITALITY (merged)
  diet:[
    {meal:"Breakfast",food:"Milk/Curd + Besan + Fruit",icon:"🌅"},
    {meal:"Snack (9-10 AM)",food:"Chana + Peanuts",icon:"🫘"},
    {meal:"Lunch",food:"Dal + Sabzi + Roti + Salad + Curd",icon:"🍛"},
    {meal:"Evening",food:"Fruit + Peanuts",icon:"🍎"},
    {meal:"Dinner",food:"Light meal only",icon:"🌙"},
  ],
  healthHabits:["🏃 Running (Daily)","🧘 Meditation (Morning+Evening+Night)","🌬️ Deep Breathing","💪 Kegel (Class Breaks)","⬆️ Pushups","⬇️ Squats","🛤️ Plank","🌅 Sunrise (2-5 min)","🌇 Sunset Walk","😴 Nap 90 min","👃 Nose Breathing (Default)","🦷 Datun (Morning)","💧 Water 3-4L daily"],
  posture:[
    {sit:"Study",rule:"Feet flat + Neutral spine + Screen at eye level"},
    {sit:"Short Tasks",rule:"Sidhasana for Anki/quick revision"},
    {sit:"Mobile",rule:"Phone up, neck up"},
    {sit:"Every 40 min",rule:"Stand, 10 shoulder rolls"},
    {sit:"After 2 hrs",rule:"Legs up wall 3 min (lower back reset)"},
    {sit:"Sleep",rule:"Left side. Head North/East. No stomach."},
  ],
  vitalityMeals:["Besan & Fruit (Morning)","Sujata High-Vitality Juice","Knorr Light Soup (Pre-Mock)"],
  sexHealth:[
    {item:"Kegel Exercises",detail:"2-3 sets/day in class breaks"},
    {item:"Sleep Consistency",detail:"Fixed 9:30PM-3AM + 90min nap"},
    {item:"Nutrition",detail:"Protein + fruits + veggies + water"},
    {item:"Compulsive Stimulation Guard",detail:"Avoid — directly affects focus and energy"},
    {item:"Sunrise + Sunset Exposure",detail:"2-5 min each — circadian + hormonal support"},
  ],
  // MONEY + GOALS (Mahindra merged)
  moneyJars:[
    {jar:"Daily Jar",amount:"₹1,500",rule:"₹50/day cap",color:C.green},
    {jar:"Shizuka/Friend Jar",amount:"₹300",rule:"Dedicated",color:C.pink},
    {jar:"Fun Jar",amount:"₹300",rule:"Limit ch masti",color:C.gold},
    {jar:"Learning Jar",amount:"₹200",rule:"Resources only",color:C.blue},
    {jar:"Saving Jar",amount:"₹2,620",rule:"Emergency ONLY",color:C.saffron},
  ],
  mahindraTarget:1500000,
  tradeInValue:80000,
  currentSaved:120000,
  mahindraDeadline:"",
  bigGoals:[
    {goal:"🏎️ Mahindra BE 6e / XEV 9e",targetAmount:"₹15,00,000",deadline:"",progress:0,notes:"Trade-in: ₹80,000. Monthly save target to track."},
    {goal:"📚 ADO/Patwari/AFO Selection",targetAmount:"N/A",deadline:"",progress:0,notes:"Main mission. Everything else supports this."},
    {goal:"🎥 YouTube Channel 10K Subs",targetAmount:"N/A",deadline:"",progress:0,notes:"Only after exam tasks done daily."},
  ],
  // WEEKLY REVIEW
  weeklyDays:[
    {day:"Monday",focus:"Full Rotation Engine",detail:"All subjects. YouTube: Idea.",highlight:false},
    {day:"Tuesday",focus:"Full Rotation Engine",detail:"Agriculture + Quant. YouTube: Research.",highlight:false},
    {day:"Wednesday",focus:"Full Rotation Engine",detail:"Agriculture + Quant. YouTube: Script.",highlight:false},
    {day:"Thursday",focus:"Full Rotation Engine",detail:"All subjects. YouTube: Record.",highlight:false},
    {day:"Friday",focus:"Full Rotation Engine",detail:"All subjects. YouTube: Edit.",highlight:false},
    {day:"Saturday",focus:"🎯 MOCK TEST NIGHT",detail:"Normal day → 8:00-10:00 PM Mock Test. Surya Nadi before. Quick scan then sleep.",highlight:true},
    {day:"Sunday",focus:"🔄 REVISION + AUDIT + ANALYSIS",detail:"Mock deep analysis. Full week revision. Anki. PYQs. Power Hour.",highlight:true},
  ],
  weeklyReview:[
    {step:"Pages/Content Read Check",detail:"Actual coverage vs weekly goal compare karo. Lagging / Ahead / On Track note karo."},
    {step:"Lecture/Topic Completion Count",detail:"Har subject de planned vs actual lectures/topics complete hoye — count karo, compare karo."},
    {step:"Active Recall Time Check",detail:"Planned active recall time vs actual hoya — verify karo, sirf padhna kafi nahi."},
    {step:"Mock Performance Analysis",detail:"Is week da mock score — strength areas + weak areas dono note karo (trendline chart vich already track ho riha)."},
    {step:"Adjust Next Week's Goals",detail:"Lagging ho taan target ya ik extra session add karo. Ahead ho taan pace maintain ya thodi flexibility lvo."},
    {step:"Plan Revision Focus",detail:"Kehrhe key topics is hafte weak rahe — unhi nu agle revision block da main focus banao."},
    {step:"Honest Reflection",detail:"Study habits, motivation, challenges — ki kaam kita, ki nahi. Honest 2-3 line note karo."},
  ],
  monthlyItems:[
    {item:"⚖️ Weight Check",detail:"Trend, not daily"},
    {item:"🏠 Environment Upgrade",detail:"Desk/room refresh"},
    {item:"📖 Full Revision Day",detail:"Last Sunday — entire month scan"},
    {item:"📊 Progress Review",detail:"Mock trend, weak topics trend"},
    {item:"🔀 Interleaved Practice",detail:"All subjects MCQs mixed"},
    {item:"🔍 Habit Audit",detail:"What works → keep. What doesn't → drop."},
    {item:"🎯 Theme Week (Optional)",detail:"Mahine vich ik hafta kisi neglected subject (Forestry, Sericulture) nu deep-dive theme banao — normal rotation se vakhra immersion"},
    {item:"📋 Interleaved Practice Day",detail:"Once/month: ALL subjects' MCQs randomly mixed in ONE sitting — real exam vich subject-wise block nahi hounda, eh real simulation hai"},
  ],
  sundayPowerHour:[
    {time:"7:40–8:00",activity:"Weekly Review",color:C.blue},
    {time:"8:00–8:20",activity:"Digital Cleanup",color:C.saffron},
    {time:"8:20–8:40",activity:"Room Reset + Upgrade",color:C.green},
    {time:"8:40–9:00",activity:"Next Week Planning",color:C.gold},
  ],
  // CHECKLIST
  checklistItems:[
    "Meditation (Morning + Night)","Deep Breathing","🌾 Agriculture topic done",
    "📊 Quant MCQs (solved on rough paper)","🧩 Reasoning MCQs","📖 English Vocab + Grammar",
    "Punjab GK Revision + MCQs","Current Affairs check","MCQs batch done",
    "PYQs analyzed","Anki Old Cards reviewed","10-15 New Anki Cards",
    "Voice Notes recorded","Short Notes (1 Page)","Active Recall session",
    "Water goal 3-4L","Walking (Lunch + Dinner)","Gratitude note",
    "Daily Revision done","Journal + Tomorrow's ONE task","📿 Geeta — 1 Page",
    "Morning + Evening Affirmation","Mistake Book entry",
  ],
  topperEdge:[
    {item:"PYQ pattern logged (which topic, which year, repeat frequency)",why:"Topper-level exam-sense — tells you exactly what to over-prepare. Frequency = priority."},
    {item:"1 mistake added to Mistake Notebook (re-solved, not just noted)",why:"Same mistake twice = biggest score leak in toppers' postmortems. Re-solving seals the gap."},
    {item:"Tomorrow's hardest topic pre-read for 5 min tonight",why:"Removes morning friction — brain primes overnight even during sleep. Massive ROI on 5 min."},
    {item:"Current Affairs 1-liner written in own words (not copied)",why:"Forces real recall, not just recognition. Passive reading = illusion of learning."},
    {item:"No open-ended scrolling after 9:25 PM (phone away)",why:"Protects sleep latency — toppers guard first 20 min of sleep fiercely. Blue light kills melatonin."},
    {item:"Sat at table within 2 min of alarm (no snooze)",why:"Discipline compounding — the real differentiator over 6 months. 2 min = 0 mental debate."},
    {item:"Topic-end finger/stylus fast scan done (visual recall, not re-reading)",why:"30-sec recall check catches gaps before they compound into exam-day surprises."},
    {item:"One mnemonic created for today's hardest-to-retain fact",why:"Weird/visual hooks beat rote — toppers build a mnemonic library over months."},
    {item:"Summary sheet written post-session (1 page, own words)",why:"Forces synthesis, not consumption — and builds final-week revision material automatically."},
    {item:"Today's score compared to yesterday's (gamify, beat your own number)",why:"Self-competition compounds faster than external comparison, with zero anxiety cost."},
  ],
  // PROGRESS
  examDate:"",
  examName:"ADO / Patwari / AFO",
  subjectProgress:[
    {subject:"🌾 Agriculture",pct:0,weakTopics:""},
    {subject:"📊 Quant",pct:0,weakTopics:""},
    {subject:"🧩 Reasoning",pct:0,weakTopics:""},
    {subject:"📖 English",pct:0,weakTopics:""},
    {subject:"💻 Computer",pct:0,weakTopics:""},
    {subject:"🏛️ Punjab GK",pct:0,weakTopics:""},
    {subject:"📰 Current Affairs",pct:0,weakTopics:""},
  ],
  milestones:[
    {label:"Syllabus 50% complete",done:false},
    {label:"First full-syllabus mock done",done:false},
    {label:"Score above cutoff for first time",done:false},
    {label:"All PYQs (last 5 yrs) analyzed",done:false},
    {label:"Mistake book full review done",done:false},
    {label:"Last 30-day push started",done:false},
  ],
  strengthWeakNote:"",
  summer60:[
    {id:"circadian",icon:"🌅",phase:"Circadian Anchor",time:"05:00 AM",how:"Wake instantly. No snooze. Phone far from bed.",max:10},
    {id:"strike",icon:"🛩️",phase:"Early Surgical Strike",time:"05:15–07:15 AM",how:"No Phone. No Dopamine. Hardest work first.",max:20},
    {id:"fuel",icon:"🥗",phase:"Clean Fuel Lunch",time:"12:30 PM",how:"No fried food. Curd rice/khichdi + lassi.",max:10},
    {id:"coolair",icon:"🌬️",phase:"Cool Air Trap Hack",time:"Afternoon",how:"No direct cooler blast on face.",max:5},
    {id:"cave",icon:"🕳️",phase:"Cave Mode Block",time:"01:15–02:45 PM",how:"Sensory blackout. Tough problems or mock tests.",max:15},
    {id:"reading",icon:"📚",phase:"Fast Reading",time:"Evening (20 min)",how:"10 pages non-fiction at high focus.",max:10},
    {id:"skill",icon:"🛠️",phase:"Micro-Skill Block",time:"Evening (30 min)",how:"30 min chosen skill. Cross 1 box on wall chart.",max:10},
    {id:"finisher",icon:"🏁",phase:"Finisher Mode Block",time:"09:00–10:00 PM",how:"Finish leftovers, revise, prep tomorrow.",max:10},
    {id:"scan",icon:"📝",phase:"Mental Day Scan",time:"10:00 PM",how:"Write mistakes + wins. Calculate score.",max:5},
    {id:"hydration",icon:"💧",phase:"Regular Hydration",time:"All Day",how:"3.5-4 Litres. Bottle in sight always.",max:5},
  ],
  // MASTER MATRIX
  studyMatrix:[
    {id:"agri",subject:"🌾 Agriculture",subTopics:[
      {name:"Agronomy & Soil Science",targetHrs:10,actualHrs:0,notes:"Focus on PYQs"},
      {name:"Animal Husbandry",targetHrs:6,actualHrs:0,notes:"Dairy + Poultry"},
      {name:"Horticulture",targetHrs:5,actualHrs:0,notes:"Fruits, Veg, Flowers"},
      {name:"Forestry + Sericulture",targetHrs:4,actualHrs:0,notes:"Neglected = hidden marks"},
      {name:"Govt Schemes + NABARD",targetHrs:4,actualHrs:0,notes:"Current + Static"},
    ]},
    {id:"quant",subject:"📊 Quant",subTopics:[
      {name:"Arithmetic",targetHrs:8,actualHrs:0,notes:"Percentage, Ratio, SI/CI"},
      {name:"Data Interpretation",targetHrs:6,actualHrs:0,notes:"Tables, Charts, Graphs"},
      {name:"Number System",targetHrs:4,actualHrs:0,notes:"Divisibility, LCM, HCF"},
    ]},
    {id:"reasoning",subject:"🧩 Reasoning",subTopics:[
      {name:"Inequality + Syllogism",targetHrs:4,actualHrs:0,notes:"Start here"},
      {name:"Blood Relations",targetHrs:3,actualHrs:0,notes:"Use tree diagrams"},
      {name:"Puzzles + Seating",targetHrs:5,actualHrs:0,notes:"Use stories/keywords"},
    ]},
    {id:"gk",subject:"🏛️ Punjab GK",subTopics:[
      {name:"Punjab History",targetHrs:5,actualHrs:0,notes:"Sikh period focus"},
      {name:"Geography + Economy",targetHrs:4,actualHrs:0,notes:"Rivers, Crops, Industries"},
      {name:"Current Affairs",targetHrs:3,actualHrs:0,notes:"Daily 10 min read"},
    ]},
  ],
  analyticsData:{
    mockScores:[65,68,72,75],
    weakAreas:[
      {topic:"Forestry",accuracy:40},
      {topic:"DI",accuracy:55},
      {topic:"Punjab History",accuracy:60},
      {topic:"Reasoning Puzzles",accuracy:48},
    ],
  },
  // DIGITAL + CONTENT (merged)
  digitalTools:[
    {tool:"GPT",purpose:"Notes, MCQs, Anki cards",color:C.green},
    {tool:"OneNote",purpose:"Knowledge Hub — Cornell method",color:C.blue},
    {tool:"Anki",purpose:"Spaced repetition engine",color:C.gold},
    {tool:"Excel",purpose:"Productivity + financial tracking",color:"#4CAF50"},
    {tool:"Canva",purpose:"YouTube thumbnails + design",color:C.pink},
    {tool:"AI Tools",purpose:"Speed up all workflows",color:C.saffron},
  ],
  digitalRules:["Notifications OFF during study","No random scrolling/reels","Monthly digital cleanup","One skill at a time","Phone away during morning study block","Click/note important things instantly"],
  youtubeWeek:[
    {day:"Monday",task:"Idea",color:C.purple},
    {day:"Tuesday",task:"Research",color:C.blue},
    {day:"Wednesday",task:"Script",color:C.green},
    {day:"Thursday",task:"Record",color:C.saffron},
    {day:"Friday",task:"Edit",color:C.gold},
    {day:"Saturday",task:"Thumbnail",color:C.pink},
    {day:"Sunday",task:"Upload 🚀",color:C.teal},
  ],
  contentSchedule:[
    {day:"Monday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Tuesday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Wednesday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Thursday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Friday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Saturday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
    {day:"Sunday",ytHours:"",ytTopic:"",fbHours:"",fbTopic:""},
  ],
  voiceNotes:[],
  ideas:[],
  vitality:{waterLiters:0},
  // FINANCE (Mahindra Engine)
  finance:{
    mahindraTarget:1500000,
    tradeInValue:80000,
    currentSaved:120000,
    jars:{daily:50,learning:200,fun:300,shizuka:300},
  },
  // COMMUNITY
  community:{
    circuit:["Gander","Madrasa","Barkandi","Chak Hakam","Ballamgarh","Chak Madarsa"],
    sarpanchScript:"Today's CM Yogshala focus: Building resilience through Nadi Shodhana.",
    youtubePipeline:[
      {day:"Mon",stage:"Idea",task:"5 Agri Tricks for Patwari"},
      {day:"Wed",stage:"Script",task:"Drafting hook + body"},
      {day:"Fri",stage:"Edit",task:"Captions + thumbnail"},
      {day:"Sun",stage:"Upload",task:"Publish 10 AM sharp"},
    ],
  },
  // V10 ADDITIONS — Nadi Activation, Mock Day, Quarterly, etc.
  nadiActivation:[
    {title:"☀️ Surya Nadi (Right Nostril) — Before Something Important",color:"#FF6B35",
      when:"Mock tests, exams, high-focus study blocks, Quant/Reasoning",
      methods:["Lie/sit on LEFT side briefly, or block left nostril with finger, breathe through right only — 5-10 rounds","Activates alertness, energy, logical processing — ideal before Quant/Reasoning or exam day"]},
    {title:"🌙 Ida Nadi (Left Nostril) — At Night",color:"#8B5CF6",
      when:"Before sleep, 9:18-9:25 PM slot",
      methods:["Lie on LEFT side (fetal position) — naturally calms mind, preps deep sleep","Nadi Shodhana: close right nostril, breathe ONLY left for 10-15 min","Armpit Trick (if sleep trouble): lie on right side, press right fist firmly into left armpit — forces left nostril open","Yogic tradition: end evening breathing right-side-last before switching to left-dominant sleep posture"]},
  ],
  mockDaySchedule:[
    {time:"3:00 AM–7:30 PM",activity:"Fully Normal Schedule",detail:"Saturday chalda hai bilkul normal study day vangu — koi disruption nahi"},
    {time:"6:30–7:00 PM",activity:"Dinner (Early)",detail:"Shift dinner earlier — mock room banane layi"},
    {time:"7:30–8:00 PM",activity:"Surya Nadi Activation",detail:"5-10 right-nostril breaths for alertness before mock. Light warm-up only."},
    {time:"8:00–10:00 PM",activity:"🎯 Full Mock Test",detail:"2 Hours — exact exam conditions. No phone. No breaks. Write on paper."},
    {time:"10:00–10:30 PM",activity:"🔍 Quick Mock Scan",detail:"Score note karo, rough error flag — deep analysis Sunday subah"},
    {time:"10:30 PM",activity:"💤 Sleep",detail:"Thodi der late (1 hr), par fixed — Sunday recovery hai"},
  ],
  weeklyMiscActivities:[
    {item:"🌱 Gardening",freq:"Weekly",slot:"Sunday Me Time window"},
    {item:"👨‍👩‍👦 Family Time",freq:"Weekly",slot:"Sunday — flexible, after Power Hour"},
    {item:"🎨 Creative Time",freq:"Weekly",slot:"Sunday — sketching/music/writing, free choice"},
    {item:"🛕 Mandir Visit",freq:"Kabhi-kabhi",slot:"Evening Me Time (7:40-8:00 PM), jadon man kare"},
  ],
  quarterlyReview:["Exam Review","Health Review","Skill Review","Financial Review","YouTube Review","Life Review"],
  periodicReviewEngine:{
    daily:"End of day: super fast active recall of all topics. Next day start: 5-10 min recall of yesterday.",
    sunday:"9PM: 30-60 min strict audit. 380-page benchmark check. Lecture completion track. Ledger Slip update. Full week syllabus. Anki + week sheets + weak note conversion.",
    lastSunday:"Full monthly check + Interleaved Practice Day (all subjects mixed). No new learning. Re-evaluate weak topics, mistakes, short notes, PYQs.",
  },
  masterSuccessFormula:["Breathe","Visualize","Learn","Understand","Mind Map","Notes","Active Recall","Write","MCQs","PYQs","Anki","Revision","Teach","Improve","Repeat!"],
  eightyTwentyFramework:{
    main:"Core 20% topics se 80% marks aande ne. PYQ-frequency analysis se eh 20% pehchaan ke unhi pe sab se zyada time lagao.",
    antiOverdo:"Pehla basic PYQ-type topics 3-4 vaar revise karo, us ton baad hi deep/extra heavy books wal jao. Heavy reference books pehle din se shuru karna = overdoing, time waste.",
  },
  sevenMinBreakdown:"1m Fast Watch → 3.5m Deep Reading + Notes → 1m Active Recall → 0.5m Mind Map → 1m GPT-Anki Cards",
  gptWorkflow:["Study Topic","GPT Summary","MCQs","Flashcards","OneNote Notes","Anki Cards","Review at Breaks"],
  spacedRepetition:["Day 0","Day 1","Day 3","Day 7","Day 15","Day 30"],
  ankiChips:[
    {label:"Break 1: 5 Min Review",color:"#3B82F6"},
    {label:"Break 2: 5 Min Review",color:"#3B82F6"},
    {label:"Before Lunch: 5 Min",color:"#3B82F6"},
    {label:"Last 3-5 min/class: New Cards",color:"#10B981"},
    {label:"10-15 Daily Cards",color:"#FF6B35"},
    {label:"Weak Topics First",color:"#FF6B35"},
  ],
  bhuaJar:{total:50000,used:2000,balance:48000,deadline:"December 2027"},
  incomeBreakdown:{total:8000,fixed:3080,net:4920},
  // SUMMER 60 SCORING RULES (from v11)
  summer60ScoringRules:[
    {score:"0 Points",rule:"Kam shuru hi nahi kitta (Completely skipped). 🛑"},
    {score:"5 Points",rule:"Shuru kitta par beech vich rukk gye ya chadd ditta (Half-hearted execution). ⚠️"},
    {score:"10 to 19 Points",rule:"Good effort but distracted in between (Only applicable for 15-20 max point tasks). 📉"},
    {score:"MAX Points (Full)",rule:"100% Military Discipline naal best execution kitti! 🏆"},
  ],
  // CONSISTENCY PRINCIPLES (from v11)
  consistencyPrinciples:[
    {title:"Never Miss Twice (Hard Rule)",detail:"Ik din miss ho sakda hai — variance hai, normal hai. Do din lagatar miss = pattern ban janda, fir habit toot jaandi. Agle din kuch v ho jaave, table te baith jao."},
    {title:"Minimum Viable Day > Zero Day",detail:"Pura schedule follow na ho sake taan v Emergency Minimum (20 MCQs + 10 min Anki + meditation) zaroor karo. Ik chhota din behtar hai zero din naal — streak survive rehni chahidi."},
    {title:"Identity-Based, Not Goal-Based",detail:"'Main aaj study karna chahunda haan' vs 'Main ik disciplined aspirant haan' — dooja zyada tikau hai. Identity statement nu roz reinforce karo, sirf goal yaad na karo."},
    {title:"Visible Streak Tracking",detail:"Streak (consecutive days checklist 70%+ complete) kithe v likhi/dikhi honi chahidi — jadon number vadhda dikhe, breaking the chain painful lagda hai, eh psychological lock kaam karda hai."},
    {title:"Pre-Commitment Over Willpower",detail:"Roz subah decide nahi karna ki study karni hai ki nahi — decision pehlan hi locked hai (schedule fixed hai). Willpower sirf execution layi use karo, decision-making layi nahi."},
    {title:"Environment Removes Friction",detail:"Books/table raat nu hi ready ho jaan — subah decision-fatigue zero honi chahidi. Jinni friction ghatt, consistency utni zyada."},
    {title:"Two-Day Rule for New Habits",detail:"Koi v naya habit add karde time — pehle do din extra easy/short version rakho, taaki habit lock ho jaave pehlan, fir full version te jao."},
    {title:"Review Without Self-Punishment",detail:"Weekly/monthly audit mein lagging dikhe taan plan adjust karo, khud nu punish nahi. Guilt consistency todda hai, course-correction usnu banaye rakhda hai."},
  ],
  // MNEMONIC LIBRARY (from v11 — 30+ methods)
  mnemonicLibrary:[
    {name:"Method of Loci (Memory Palace)",steps:["Ek jaana-pehchana jagah chunein","Key spots yaad karein","Har spot par information assign karein","Path ko mentally walk karein","Path follow karke recall karein"]},
    {name:"Acronyms and Acrostics",steps:["Items ki list banayein","Har item da initial letter lao","In letters se ek word ya sentence banao","Acronym meaningful ho","Acronym yaad karein aur items recall karein"]},
    {name:"Visualization",steps:["Jo yaad karna hai identify karein","Vivid mental image banayein","Details aur emotions add karein","Image ko known concept se link karein","Image recall karein jad zarurat ho"]},
    {name:"Chunking",steps:["Complex info nu chhote parts vich divide karo","Similar items nu groups vich organize karo","Har group da ek subset banao","Subsets nu label karo","Har chunk nu alag-alag revise karo"]},
    {name:"Spaced Repetition",steps:["Important points identify karo","Review schedule banao","Fixed intervals par review karo","Khud nu test karo","Intervals adjust karo based on learning"]},
    {name:"Feynman Technique",steps:["Ek topic choose karo","Topic nu simple terms vich explain karo","Explanation vich gaps identify karo","Material review karo to fill gaps","Explanation refine karo"]},
    {name:"Story Method",steps:["Information ikattha karo","Story banao","Story vich emotions aur details add karo","Events nu logically sequence karo","Story repeat karo aur information yaad karo"]},
    {name:"Mind Mapping",steps:["Central idea chunein","Related subtopics branches vich dikhao","Har branch par details add karo","Colors aur symbols use karo for clarity","Mind map review aur update karo"]},
    {name:"Keyword Method",steps:["Foreign word identify karo","Similar sounding native word dhundho","Dono words nu ek image naal link karo","Image clearly visualize karo","Image naal word recall karo"]},
    {name:"Peg System",steps:["Numbers layi associated words/images yaad karo","Information nu peg words naal jodo","Connection visualize karo","Peg words use karke recall karo","Associations regularly practice karo"]},
    {name:"Rhymes and Songs",steps:["Yaad karne wali info chunein","Simple rhyme ya tune vich set karo","Rhythmic aur melodious banao","Baar-baar practice karo","Tune naal information recall karo"]},
    {name:"Dual Coding",steps:["Study material chunein","Charts ya diagrams banao","Visuals nu text naal link karo","Dono ikathe review karo","Dono naal recall karo"]},
    {name:"Retrieval Practice",steps:["Topic choose karo","Apne aap nu test karo","Weak areas identify karo","Weak areas par focus karo","Regular testing karo"]},
    {name:"Interleaved Practice",steps:["Multiple topics choose karo","Topics nu study session vich mix karo","Regularly topics switch karo","Topics de beech connections dhundho","Mixed practice sessions review karo"]},
    {name:"Peer Teaching",steps:["Topic choose karo","Explanation prepare karo","Peers nu topic sikhao","Feedback lao","Teaching reflect aur revise karo"]},
    {name:"Elaborative Interrogation",steps:["Ek fact identify karo","Us fact par WHY questions puchho","Answers explore karo","Facts nu existing knowledge naal link karo","Understanding review karo"]},
    {name:"Progressive Summarization",steps:["Material thoroughly read karo","Key points highlight karo","Summary write karo","Redundancy hataao","Summary regularly review karo"]},
    {name:"Analogies and Metaphors",steps:["Concept identify karo","Related analogy dhundho","Analogy naal concept explain karo","Connection banao","Understanding review karo"]},
    {name:"Gamification",steps:["Learning goals set karo","Challenges create karo for each goal","Rewards system implement karo","Achievements track karo","Progress reflect karo and adjust"]},
    {name:"Sensory Association",steps:["Sensory element identify karo","Sensory element nu information naal link karo","Strong association banao","Sensory cues naal recall karo","Associations refine karo"]},
    {name:"Memory Journaling",steps:["Journal select karo","Learning insights record karo","Regularly reflect karo","Learning goals set karo","Journal review for progress"]},
    {name:"Backward Review",steps:["Study material select karo","Material de end ton shuru karo","Backward review karo","Key points identify karo","Understanding consolidate karo"]},
    {name:"Narrative Chain",steps:["Information select karo","Story chain banao jo information link kare","Logical flow add karo","Visual elements add karo","Story chain naal recall karo"]},
    {name:"Semantic Mapping",steps:["Topic identify karo","Semantic map draw karo","Concepts link karo within map","Examples aur details add karo","Map nu revision layi use karo"]},
    {name:"Self-Reference Effect",steps:["Information identify karo","Information nu personally relate karo","Personal examples banao","Personal connection visualize karo","Self-reference naal recall karo"]},
    {name:"Mnemonics with Movement",steps:["Information identify karo","Movement naal link karo","Movement practice karo","Action visualize karo","Movement naal recall karo"]},
    {name:"Use of Colors",steps:["Study material select karo","Information nu color code karo","Visual patterns banao using colors","Colors naal review karo","Colors naal recall karo"]},
    {name:"Active Learning",steps:["Topic choose karo","Discussion ya teaching naal engage karo","Topic summarize karo apne words vich","Practical application dekho","Learning pe reflect karo"]},
    {name:"Role-Playing",steps:["Scenario select karo","Roles assign karo","Situation act out karo","Experience pe reflect karo","Insights discuss karo"]},
    {name:"Overlearning",steps:["Basics master karo","Mastery ke baad vi practice karo","Skills refine karo","New challenges dhundho","Retention ensure through regular practice"]},
  ],
  dietRule50_25_25:true,
  healthPhilosophy:"Health alag pillar nahi — study system de andar embedded habit hai. Running (8min) + Meditation (20min total) + Deep Breathing (15min) + Kegel (2-3min) + Walking (breaks) + Hydration (throughout) + Sunrise/Sunset + 7hr sleep (5.5 night + 1.5 nap) — sab kuch already schedule vich fit hai.",
};

// ─── SELF-CONTROL SCIENCE CONSTANTS ─────────────────────────────────────────
const SELF_CONTROL_RULES=[
  {title:"Bolo Mat, Bano — 'I Just Do It' Mantra",time:"2:31–5:01",detail:"Bade waade band karo. Har task ko ek clear TRIGGER naal jodo. 'Alarm bajdi hai → main table te baith janda haan' — koi debate nahi, koi planning nahi, bas execute.",icon:"🎯",color:C.saffron},
  {title:"Create Distance Rule — Gap Banao",time:"5:01–6:54",detail:"Bhavnaon (feelings) aur apni reaction de beech ek gap banao. Thoughts nu permanent events di jagah temporary clouds di tarah dekho. Phone utha lena chahunda si? Pause. 10 sec wait. Fir decide.",icon:"🧘",color:C.blue},
  {title:"Excuse Repeat Mat Karo — Turant Sudhaaro",time:"6:54–9:06",detail:"Ik baar chook gayi → thik hai. Par excuse banana aur wahi situation dobara repeat karna = system failure. Apne faislon nu 'compulsory' banao — option hi nahi chhadna.",icon:"🔄",color:C.green},
  {title:"Sahi Battlefield Chuno — Environment Design",time:"9:06–10:36",detail:"Self-control di zaroorat GHATT karo by designing your environment. Books raat nu ready, phone duur, study table set — so 3 AM te koi friction na hove. Kal di preparation aaj raat karo.",icon:"🏗️",color:C.purple},
];
const SC_SCIENCE={title:"Frontal Lobe = Brain's Braking System",time:"0:36–2:29",detail:"Dimag da 'Frontal Lobe' saada behaviour da 'braking system' hai. Dopamine overstimulation (jiven phone di lat) isnu kamzor banaundi hai. Isliye phone = enemy of discipline. Jo ziada scroll karda hai, ohda self-control naturally weaker ho janda hai.",icon:"🧠"};

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────
function Card({children,style,glow}){
  return(
    <div style={{...glass,padding:20,marginBottom:16,
      boxShadow:glow?`0 0 20px ${glow}22`:glass.boxShadow,
      border:`1px solid ${glow?glow+"44":C.border}`,...style}}>
      {children}
    </div>
  );
}

function SectionTitle({icon,title,sub}){
  return(
    <div style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
        <div style={{background:C.cardLight,padding:10,borderRadius:14,border:`1px solid ${C.border}`,fontSize:24}}>{icon}</div>
        <h2 style={{margin:0,fontSize:22,fontWeight:900,background:`linear-gradient(90deg,#fff,${C.muted})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{title}</h2>
      </div>
      {sub&&<p style={{margin:"0 0 0 60px",color:C.muted,fontSize:13}}>{sub}</p>}
    </div>
  );
}

// Inline editable text — works in both edit and view mode
function ET({value,onChange,multiline,style,placeholder}){
  const{em}=useEC();
  const[editing,setEditing]=useState(false);
  const[draft,setDraft]=useState(value);
  useEffect(()=>{setDraft(value);},[value]);
  if(!em)return(<span style={style}>{value||<span style={{color:C.muted,fontStyle:"italic",fontSize:11}}>{placeholder||"—"}</span>}</span>);
  if(editing){
    const Tag=multiline?"textarea":"input";
    return(
      <span style={{display:"flex",gap:4,alignItems:"flex-start",width:"100%"}}>
        <Tag autoFocus value={draft||""} placeholder={placeholder} onChange={e=>setDraft(e.target.value)}
          style={{flex:1,background:"rgba(0,0,0,0.5)",border:`1px solid ${C.gold}`,borderRadius:8,padding:"8px 10px",color:"#fff",fontSize:13,minHeight:multiline?70:undefined,boxSizing:"border-box",outline:"none",resize:multiline?"vertical":undefined}}/>
        <button onClick={()=>{onChange(draft);setEditing(false);}} style={{background:C.green,color:"#fff",border:"none",borderRadius:6,padding:"6px 8px",cursor:"pointer"}}>✓</button>
        <button onClick={()=>{setDraft(value);setEditing(false);}} style={{background:"#FF000055",color:"#fff",border:"none",borderRadius:6,padding:"6px 8px",cursor:"pointer"}}>✕</button>
      </span>
    );
  }
  return(
    <span onClick={()=>{setDraft(value);setEditing(true);}} style={{...style,cursor:"pointer",borderBottom:`1px dashed ${C.gold}66`}} title="Click to edit">
      {value||<span style={{color:C.muted,fontStyle:"italic",fontSize:11}}>{placeholder||"Click to add..."}</span>}
      <span style={{fontSize:9,opacity:0.4,marginLeft:3}}>✏️</span>
    </span>
  );
}

const IS={background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:12,width:"100%",boxSizing:"border-box",outline:"none"};

// Editable simple string list
function StrList({path,renderItem,addLabel,addDefault}){
  const{data,set,em}=useEC();
  const list=data[path]||[];
  return(
    <div>
      {list.map((item,i)=>(
        <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0"}}>
          <div style={{flex:1}}>
            {renderItem?renderItem(item,i):<ET value={item} onChange={v=>{const u=[...list];u[i]=v;set(path,u);}} style={{color:C.text,fontSize:13}}/>}
          </div>
          {em&&<button onClick={()=>set(path,list.filter((_,j)=>j!==i))} style={{background:"#FF000022",border:"none",color:C.red,borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button>}
        </div>
      ))}
      {em&&<button onClick={()=>set(path,[...list,addDefault||"New item..."])} style={{marginTop:8,background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>+ {addLabel||"Add Item"}</button>}
    </div>
  );
}

// Editable object list
function ObjList({path,fields,blank,renderRow,addLabel}){
  const{data,set,em}=useEC();
  const list=data[path]||[];
  const updField=(i,f,v)=>set(path,list.map((it,j)=>j===i?{...it,[f]:v}:it));
  if(!em)return(<div>{list.map((item,i)=><div key={i}>{renderRow(item,i)}</div>)}</div>);
  return(
    <div>
      {list.map((item,i)=>(
        <div key={i} style={{background:"rgba(0,0,0,0.25)",border:`1px solid ${C.gold}33`,borderRadius:10,padding:12,marginBottom:8}}>
          {fields.map(f=>(
            <div key={f.key} style={{marginBottom:6}}>
              <div style={{color:C.muted,fontSize:10,marginBottom:2}}>{f.label}</div>
              {f.multiline
                ?<textarea value={item[f.key]||""} onChange={e=>updField(i,f.key,e.target.value)} style={{...IS,minHeight:50,resize:"vertical"}}/>
                :<input value={item[f.key]||""} onChange={e=>updField(i,f.key,e.target.value)} style={IS}/>
              }
            </div>
          ))}
          <button onClick={()=>set(path,list.filter((_,j)=>j!==i))} style={{background:"#FF000022",border:"1px solid #FF000044",color:C.red,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Remove</button>
        </div>
      ))}
      <button onClick={()=>set(path,[...list,{...blank,_id:Date.now()}])} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>+ {addLabel||"Add"}</button>
    </div>
  );
}

// ─── MONTHLY RECORD WIDGET ───────────────────────────────────────────────────
// Generic reusable monthly tracker: saves one record per month with custom fields
function MonthlyRecord({storagePrefix,fields,title,color}){
  const[records,setRecords]=useState([]);
  const[current,setCurrent]=useState({});
  const[view,setView]=useState("entry");
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      const keys=await stList(storagePrefix+":");
      const loaded=[];
      for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
      loaded.sort((a,b)=>a.month>b.month?-1:1);
      setRecords(loaded);
      // Load current month draft
      const mk=monthKey();
      const draft=await stGet(storagePrefix+":"+mk);
      if(draft)setCurrent(draft.data||{});
    })();
  },[storagePrefix]);

  const save=async()=>{
    setSaving(true);
    const mk=monthKey();
    const entry={month:mk,savedAt:Date.now(),data:current};
    await stSet(storagePrefix+":"+mk,entry);
    const keys=await stList(storagePrefix+":");
    const loaded=[];
    for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
    loaded.sort((a,b)=>a.month>b.month?-1:1);
    setRecords(loaded);
    setSaving(false);
    setView("history");
  };

  const c=color||C.gold;
  return(
    <Card glow={c}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:c,fontWeight:700,fontSize:13}}>📅 {title} — Monthly Log</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setView("entry")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="entry"?c:"rgba(255,255,255,0.06)",color:view==="entry"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>✏️ This Month</button>
          <button onClick={()=>setView("history")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="history"?c:"rgba(255,255,255,0.06)",color:view==="history"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>📚 History ({records.length})</button>
        </div>
      </div>
      {view==="entry"&&(
        <div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>{monthKey()} — current month</div>
          {fields.map(f=>(
            <div key={f.key} style={{marginBottom:10}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.label}</div>
              {f.type==="textarea"
                ?<textarea value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={{...IS,minHeight:55,resize:"vertical"}} placeholder={f.placeholder||""}/>
                :<input type={f.type||"text"} value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={IS} placeholder={f.placeholder||""}/>
              }
            </div>
          ))}
          <button onClick={save} style={{background:c,color:"#000",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:800,cursor:"pointer",fontSize:12,marginTop:4}}>{saving?"Saving...":"💾 Save This Month"}</button>
        </div>
      )}
      {view==="history"&&(
        <div>
          {records.length===0&&<div style={{color:C.muted,fontSize:12}}>No records yet. Save this month first.</div>}
          {records.map((r,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:12,marginBottom:8,border:`1px solid ${c}22`}}>
              <div style={{color:c,fontWeight:800,fontSize:12,marginBottom:6}}>{r.month}</div>
              {fields.map(f=>(
                <div key={f.key} style={{marginBottom:4}}>
                  <span style={{color:C.muted,fontSize:11}}>{f.label}: </span>
                  <span style={{color:C.text,fontSize:12}}>{r.data?.[f.key]||"—"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── DAILY LOG WIDGET ─────────────────────────────────────────────────────────
// Saves one entry per day, shows last 30 days
function DailyLog({storagePrefix,fields,title,color}){
  const[entries,setEntries]=useState([]);
  const[current,setCurrent]=useState({});
  const[view,setView]=useState("entry");
  const[saving,setSaving]=useState(false);
  const c=color||C.blue;

  const load=async()=>{
    const keys=await stList(storagePrefix+":");
    const loaded=[];
    for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
    loaded.sort((a,b)=>a.date>b.date?-1:1);
    setEntries(loaded.slice(0,60));
    const today=await stGet(storagePrefix+":"+todayStr());
    if(today)setCurrent(today.data||{});
  };
  useEffect(()=>{load();},[storagePrefix]);

  const save=async()=>{
    setSaving(true);
    const entry={date:todayStr(),savedAt:Date.now(),data:current};
    await stSet(storagePrefix+":"+todayStr(),entry);
    await load();
    setSaving(false);
  };

  return(
    <Card glow={c}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:c,fontWeight:700,fontSize:13}}>📝 {title} — Daily Log</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setView("entry")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="entry"?c:"rgba(255,255,255,0.06)",color:view==="entry"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>Today</button>
          <button onClick={()=>setView("history")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="history"?c:"rgba(255,255,255,0.06)",color:view==="history"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>Log ({entries.length})</button>
        </div>
      </div>
      {view==="entry"&&(
        <div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>{todayStr()}</div>
          {fields.map(f=>(
            <div key={f.key} style={{marginBottom:10}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.label}</div>
              {f.type==="textarea"
                ?<textarea value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={{...IS,minHeight:44,resize:"vertical"}} placeholder={f.placeholder||""}/>
                :<input type={f.type||"text"} value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={IS} placeholder={f.placeholder||""}/>
              }
            </div>
          ))}
          <button onClick={save} style={{background:c,color:"#000",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:800,cursor:"pointer",fontSize:12}}>{saving?"...":" 💾 Save Today"}</button>
        </div>
      )}
      {view==="history"&&(
        <div style={{maxHeight:320,overflowY:"auto"}}>
          {entries.length===0&&<div style={{color:C.muted,fontSize:12}}>No entries yet.</div>}
          {entries.map((r,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:10,marginBottom:6,border:`1px solid ${c}22`}}>
              <div style={{color:c,fontWeight:700,fontSize:11,marginBottom:4}}>{r.date}</div>
              {fields.map(f=>(
                <div key={f.key} style={{display:"flex",gap:6,marginBottom:2}}>
                  <span style={{color:C.muted,fontSize:11,minWidth:80}}>{f.label}:</span>
                  <span style={{color:C.text,fontSize:11}}>{r.data?.[f.key]||"—"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── DAILY CHECKLIST GROUP (reusable, persists checked state per day) ────────
// Used for Spiritual Growth, Environment Design, and any future fixed daily
// checklist that needs real persistence (unlike the freeform Checklist tab,
// which only logs an overall %, this saves each item's checked state itself).
function DailyChecklistGroup({storageKey,title,icon,color,items}){
  const c=color||C.purple;
  const today=todayStr();
  const[checked,setChecked]=useState({});
  const[history,setHistory]=useState([]);
  const[loaded,setLoaded]=useState(false);

  const load=async()=>{
    const todayEntry=await stGet(storageKey+":"+today);
    setChecked(todayEntry?.checked||{});
    const keys=await stList(storageKey+":");
    const all=[];for(const k of keys){const v=await stGet(k);if(v)all.push(v);}
    all.sort((a,b)=>a.date>b.date?-1:1);
    setHistory(all.slice(0,14));
    setLoaded(true);
  };
  useEffect(()=>{load();},[storageKey]);

  const toggle=async i=>{
    const updated={...checked,[i]:!checked[i]};
    setChecked(updated);
    await stSet(storageKey+":"+today,{date:today,checked:updated});
    load();
  };

  const score=Object.values(checked).filter(Boolean).length;
  const pct=items.length?Math.round((score/items.length)*100):0;

  return(
    <Card glow={c}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{color:c,fontWeight:800,fontSize:13}}>{icon} {title}</div>
        <div style={{color:pct===100?C.green:c,fontWeight:800,fontSize:13}}>{score}/{items.length} ({pct}%)</div>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",marginBottom:12}}>
        <div style={{height:"100%",width:pct+"%",background:pct===100?C.green:c,transition:"width 0.3s"}}/>
      </div>
      {items.map((item,i)=>(
        <div key={i} onClick={()=>toggle(i)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<items.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
          <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked[i]?c:"rgba(255,255,255,0.2)"}`,background:checked[i]?c:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {checked[i]&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
          </div>
          <span style={{color:checked[i]?c:C.text,fontSize:13,textDecoration:checked[i]?"line-through":"none"}}>{item}</span>
        </div>
      ))}
      {loaded&&history.length>0&&(
        <div style={{marginTop:14}}>
          <div style={{color:C.muted,fontSize:10,marginBottom:6}}>LAST {history.length} DAYS</div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
            {history.slice().reverse().map((h,i)=>{
              const hp=items.length?Math.round((Object.values(h.checked||{}).filter(Boolean).length/items.length)*100):0;
              return <div key={i} title={`${h.date}: ${hp}%`} style={{width:14,height:14,borderRadius:3,background:hp===100?C.green:hp>=50?c:hp>0?C.gold:"rgba(255,255,255,0.08)"}}/>;
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── WEEKLY LOG (same UI/pattern as DailyLog, keyed per ISO week instead of day) ─
function WeeklyLog({storagePrefix,fields,title,color}){
  const[entries,setEntries]=useState([]);
  const[current,setCurrent]=useState({});
  const[view,setView]=useState("entry");
  const[saving,setSaving]=useState(false);
  const c=color||C.blue;
  const wk=weekKey();

  const load=async()=>{
    const keys=await stList(storagePrefix+":");
    const loaded=[];
    for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
    loaded.sort((a,b)=>a.week>b.week?-1:1);
    setEntries(loaded.slice(0,52));
    const thisWeek=await stGet(storagePrefix+":"+wk);
    if(thisWeek)setCurrent(thisWeek.data||{});
  };
  useEffect(()=>{load();},[storagePrefix]);

  const save=async()=>{
    setSaving(true);
    const entry={week:wk,savedAt:Date.now(),data:current};
    await stSet(storagePrefix+":"+wk,entry);
    await load();
    setSaving(false);
  };

  return(
    <Card glow={c}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{color:c,fontWeight:700,fontSize:13}}>🗓️ {title} — Weekly Log</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setView("entry")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="entry"?c:"rgba(255,255,255,0.06)",color:view==="entry"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>This Week</button>
          <button onClick={()=>setView("history")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:view==="history"?c:"rgba(255,255,255,0.06)",color:view==="history"?"#000":"#fff",fontWeight:700,cursor:"pointer",fontSize:11}}>Log ({entries.length})</button>
        </div>
      </div>
      {view==="entry"&&(
        <div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Week of {wk}</div>
          {fields.map(f=>(
            <div key={f.key} style={{marginBottom:10}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.label}</div>
              {f.type==="textarea"
                ?<textarea value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={{...IS,minHeight:44,resize:"vertical"}} placeholder={f.placeholder||""}/>
                :<input type={f.type||"text"} value={current[f.key]||""} onChange={e=>setCurrent({...current,[f.key]:e.target.value})} style={IS} placeholder={f.placeholder||""}/>
              }
            </div>
          ))}
          <button onClick={save} style={{background:c,color:"#000",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:800,cursor:"pointer",fontSize:12}}>{saving?"...":" 💾 Save This Week"}</button>
        </div>
      )}
      {view==="history"&&(
        <div style={{maxHeight:320,overflowY:"auto"}}>
          {entries.length===0&&<div style={{color:C.muted,fontSize:12}}>No entries yet.</div>}
          {entries.map((r,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:10,marginBottom:6,border:`1px solid ${c}22`}}>
              <div style={{color:c,fontWeight:700,fontSize:11,marginBottom:4}}>Week of {r.week}</div>
              {fields.map(f=>(
                <div key={f.key} style={{display:"flex",gap:6,marginBottom:2}}>
                  <span style={{color:C.muted,fontSize:11,minWidth:110}}>{f.label}:</span>
                  <span style={{color:C.text,fontSize:11}}>{r.data?.[f.key]||"—"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── MINI BAR CHART (shared, reusable across Analytics sections) ─────────────
function MiniBarChart({data,color,suffix="",height=90,goodAbove=70,okAbove=40}){
  if(!data||!data.length)return <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No data yet.</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  const colorFor=v=>color?color:(v>=goodAbove?C.green:v>=okAbove?C.gold:C.red);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height,overflowX:"auto",paddingBottom:2}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,minWidth:18,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{color:colorFor(d.value),fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>{d.value}{suffix}</div>
          <div style={{width:"100%",height:Math.max(4,(d.value/max)*((height-26))),background:colorFor(d.value),borderRadius:"3px 3px 0 0",transition:"height 0.4s"}}/>
          <div style={{color:C.muted,fontSize:8,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",maxWidth:34}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ─── LIFE BALANCE WHEEL ──────────────────────────────────────────────────────
function LifeBalanceWheel(){
  const WHEEL_KEY="life-balance-wheel";
  const AREAS=[
    {label:"Study",color:"#3B82F6"},
    {label:"Health",color:"#10B981"},
    {label:"Finance",color:"#F4A726"},
    {label:"Spiritual",color:"#8B5CF6"},
    {label:"Social",color:"#EC4899"},
    {label:"Fun/Hobby",color:"#FF6B35"},
    {label:"Sleep",color:"#14B8A6"},
    {label:"Purpose",color:"#F8FAFC"},
  ];
  const[scores,setScores]=useState(AREAS.map(()=>5));
  const[loaded,setLoaded]=useState(false);
  const[saved,setSaved]=useState(false);
  useEffect(()=>{stGet(WHEEL_KEY).then(v=>{if(v&&v.scores)setScores(v.scores);setLoaded(true);}).catch(()=>setLoaded(true));},[]);
  const save=async()=>{await stSet(WHEEL_KEY,{scores,date:todayStr()});setSaved(true);setTimeout(()=>setSaved(false),1800);};
  const cx=110,cy=110,R=90,N=AREAS.length;
  const pts=scores.map((s,i)=>{const a=(Math.PI*2*i/N)-Math.PI/2;const r=(s/10)*R;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];});
  const polygon=pts.map(p=>p.join(",")).join(" ");
  const spokes=AREAS.map((_,i)=>{const a=(Math.PI*2*i/N)-Math.PI/2;return[cx+R*Math.cos(a),cy+R*Math.sin(a)];});
  const labels=AREAS.map((ar,i)=>{const a=(Math.PI*2*i/N)-Math.PI/2;const r=R+20;return{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a),label:ar.label,color:ar.color};});
  return(
    <Card glow={C.purple}>
      <div style={{fontSize:12,color:C.purple,fontWeight:700,marginBottom:14,letterSpacing:1}}>🎡 LIFE BALANCE WHEEL</div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
        <svg width={220} height={220} style={{overflow:"visible"}}>
          {[2,4,6,8,10].map(ring=>(
            <polygon key={ring} points={AREAS.map((_,i)=>{const a=(Math.PI*2*i/N)-Math.PI/2;const r=(ring/10)*R;return`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(" ")} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
          ))}
          {spokes.map(([sx,sy],i)=><line key={i} x1={cx} y1={cy} x2={sx} y2={sy} stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>)}
          <polygon points={polygon} fill="rgba(139,92,246,0.25)" stroke={C.purple} strokeWidth={2}/>
          {pts.map(([px,py],i)=><circle key={i} cx={px} cy={py} r={5} fill={AREAS[i].color} stroke="#000" strokeWidth={1}/>)}
          {labels.map((l,i)=><text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill={l.color}>{l.label}</text>)}
        </svg>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {AREAS.map((ar,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:ar.color,flexShrink:0}}/>
            <span style={{color:C.muted,fontSize:11,minWidth:60}}>{ar.label}</span>
            <input type="range" min={0} max={10} value={scores[i]} onChange={e=>{const u=[...scores];u[i]=Number(e.target.value);setScores(u);}} style={{flex:1,height:4,accentColor:ar.color}}/>
            <span style={{color:ar.color,fontWeight:700,fontSize:12,minWidth:16,textAlign:"right"}}>{scores[i]}</span>
          </div>
        ))}
      </div>
      <button onClick={save} style={{background:C.purple,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:800,cursor:"pointer",fontSize:12,width:"100%"}}>{saved?"✓ Saved!":"💾 Save Balance Wheel"}</button>
    </Card>
  );
}

function IdentityTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="👑" title="Identity & Mindset" sub="Jadon vi aalas aave — isnu unchi aawaz ch padhna hai!"/>
      <Card glow={C.saffron} style={{padding:28}}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10,letterSpacing:1}}>🔥 IDENTITY STATEMENT</div>
        <ET value={data.identityStatement} onChange={v=>set("identityStatement",v)} multiline style={{fontSize:15,color:C.text,lineHeight:1.8,fontWeight:600,whiteSpace:"pre-line"}}/>
      </Card>
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🙏 AFFIRMATIONS</div>
        <div style={{marginBottom:12}}>
          <div style={{color:C.saffron,fontSize:11,fontWeight:700,marginBottom:4}}>🌅 Morning:</div>
          <ET value={data.morningAffirmation} onChange={v=>set("morningAffirmation",v)} multiline style={{color:C.text,fontSize:13,display:"block"}}/>
        </div>
        <div>
          <div style={{color:C.purple,fontSize:11,fontWeight:700,marginBottom:4}}>🌙 Evening:</div>
          <ET value={data.eveningAffirmation} onChange={v=>set("eveningAffirmation",v)} multiline style={{color:C.text,fontSize:13,display:"block"}}/>
        </div>
      </Card>
      <Card><div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>👑 PRIORITY ORDER</div><StrList path="priorities" addLabel="Add Priority"/></Card>
      <Card><div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>💎 PHILOSOPHY CODES</div><StrList path="philosophyCodes" addLabel="Add Code" renderItem={(item,i)=>{const{data,set,em}=useEC();return(<span style={{color:"#B8C7D8",fontSize:13}}>→ <ET value={item} onChange={v=>{const u=[...data.philosophyCodes];u[i]=v;set("philosophyCodes",u);}} style={{display:"inline"}}/></span>);}}/></Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🧠 MINDSET RULES</div>
        <ObjList path="mindsetRules" fields={[{key:"icon",label:"Icon"},{key:"title",label:"Title"},{key:"detail",label:"Detail",multiline:true}]} blank={{icon:"⭐",title:"New Rule",detail:"..."}} addLabel="Add Rule"
          renderRow={(r,i)=><div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:18,minWidth:28}}>{r.icon}</span><div><div style={{color:C.text,fontWeight:700,fontSize:13}}>{r.title}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{r.detail}</div></div></div>}
        />
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🧲 SELF-CONTROL RULES</div>
        <ObjList path="selfControlRules" fields={[{key:"icon",label:"Icon"},{key:"title",label:"Title"},{key:"detail",label:"Detail",multiline:true}]} blank={{icon:"⭐",title:"New Rule",detail:"..."}} addLabel="Add Rule"
          renderRow={(r,i)=><div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:18,minWidth:28}}>{r.icon}</span><div><div style={{color:C.saffron,fontWeight:700,fontSize:13}}>{r.title}</div><div style={{color:C.muted,fontSize:12,marginTop:2}}>{r.detail}</div></div></div>}
        />
      </Card>
      <Card style={{background:"rgba(239,68,68,0.05)",border:`1px solid ${C.red}33`}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:4}}>🚫 HIDDEN THUGS (Distractions)</div>
        <div style={{color:C.red,fontSize:11,marginBottom:10}}>Sab ton vadda khatra: distraction disguised as productivity.</div>
        <ObjList path="thugs" fields={[{key:"thug",label:"Thug"},{key:"trap",label:"The Trap"},{key:"result",label:"Result"},{key:"rule",label:"Counter-Rule"}]} blank={{thug:"New Thug",trap:"...",result:"...",rule:"..."}} addLabel="Add Thug"
          renderRow={(t,i)=><div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:"#FF8A8A",fontWeight:700,fontSize:13}}>{i+1}. {t.thug}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}><i>{t.trap}</i> → {t.result}</div><div style={{color:C.green,fontSize:12,marginTop:4}}>✅ {t.rule}</div></div>}
        />
      </Card>
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🌙 GOLDEN QUESTIONS — Har Raat 9 PM</div>
        <StrList path="goldenQuestions" addLabel="Add Question" renderItem={(q,i)=>{const{data,set,em}=useEC();return(<span style={{color:C.text,fontSize:13}}>{i+1}. <ET value={q} onChange={v=>{const u=[...data.goldenQuestions];u[i]=v;set("goldenQuestions",u);}} style={{display:"inline"}}/></span>);}}/>
        <div style={{marginTop:10,padding:"8px 12px",background:"rgba(244,167,38,0.1)",borderRadius:8,color:C.text,fontSize:12,fontWeight:600}}><ET value={data.goldenRuleNote||"Je 3 vicho 2 positive ne → sahi direction vich ja reha hai."} onChange={v=>set("goldenRuleNote",v)} style={{color:C.text,fontSize:12,fontWeight:600}}/></div>
      </Card>

      {/* LIFE VISION 2026-2029 — FROM V10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:12,letterSpacing:1}}>🪐 LIFE VISION 2026–2029</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {(data.lifeVision||[]).map((item,i)=>(
            <div key={i} style={{flex:"1 1 140px",background:item.color+"11",border:`1px solid ${item.color}33`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:22,marginBottom:4}}>{item.icon}</div>
              <div style={{color:item.color,fontWeight:700,fontSize:13}}>{item.label}</div>
              <div style={{color:C.muted,fontSize:11}}>{item.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ELIMINATION MATRIX — FROM V10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>🛠️ ELIMINATION MATRIX (What to END)</div>
        <StrList path="eliminationMatrix" addLabel="Add Item" renderItem={(item,i)=><span style={{color:"#FF6B6B",fontSize:13}}>✕ {item}</span>}/>
      </Card>
      {/* ── LIFE BALANCE WHEEL ── */}
      <LifeBalanceWheel/>

      {/* ANTI-THUG RULE BADGES — FROM V10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>⚔️ ANTI-THUG RULES</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(data.antiThugRules||[]).map((rule,i)=>(
            <span key={i} style={{background:"#FF000015",border:"1px solid #FF000030",color:"#FF6B6B",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:600}}>{rule}</span>
          ))}
        </div>
      </Card>

      <Card style={{background:"rgba(255,107,53,0.06)",border:"1px solid rgba(255,107,53,0.25)"}}>
        <div style={{fontSize:12,color:"#FF9D5C",fontWeight:700,marginBottom:10}}>🛟 BACKUP PLANS (Non-Ideal Days)</div>
        <ObjList path="backupPlans" fields={[{key:"trigger",label:"Situation"},{key:"plan",label:"Backup Plan",multiline:true}]} blank={{trigger:"New situation",plan:"..."}} addLabel="Add Backup"
          renderRow={b=><div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:"#FF9D5C",fontWeight:700,fontSize:12}}>⚠️ {b.trigger}</div><div style={{color:C.text,fontSize:12,marginTop:2}}>→ {b.plan}</div></div>}
        />
      </Card>
    </div>
  );
}

function ScheduleTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="🌅" title="Daily Master Schedule" sub="3:00 AM → 9:30 PM"/>

      {/* 3 AM RITUAL CALLOUT */}
      <Card glow={C.purple} style={{background:"linear-gradient(135deg,rgba(139,92,246,0.1),rgba(255,107,53,0.06))"}}>
        <div style={{fontSize:12,color:C.purple,fontWeight:700,marginBottom:10,letterSpacing:1}}>🌙 3 AM WARRIOR SEQUENCE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {["💧 2 Glasses Water","🙏 Nishkam Karma (3:02)","🏃 Running (3:07)","🧘 Meditation + Breathing (3:15)","✨ 5 Breaths + Sankalp (3:25)","📚 Study Block 1 START (3:27)"].map((step,i)=>(
            <div key={i} style={{background:"rgba(139,92,246,0.12)",border:`1px solid ${C.purple}33`,borderRadius:8,padding:"5px 10px",color:C.text,fontSize:12,display:"flex",gap:6,alignItems:"center"}}>
              <span style={{color:C.purple,fontWeight:800,fontSize:10}}>{i+1}</span><span>{step}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,background:"rgba(255,107,53,0.1)",border:`1px solid ${C.saffron}33`,borderRadius:8,padding:"8px 12px",color:C.saffron,fontSize:12,fontWeight:700}}>
          🔔 Alarm label: "ADO chahida ya 3 hor saal?" — No snooze. No negotiation. Sit at table within 2 min.
        </div>
      </Card>

      {/* TIME BLOCKS */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>⏰ FULL DAY TIME BLOCKS</div>
        <ObjList path="schedule" fields={[{key:"time",label:"Time"},{key:"activity",label:"Activity"},{key:"detail",label:"Detail",multiline:true},{key:"color",label:"Color (hex)"}]} blank={{time:"00:00",activity:"New Block",detail:"...",color:C.saffron}} addLabel="Add Time Block"
          renderRow={item=><div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"10px 12px",borderLeft:`3px solid ${item.color||C.muted}`,display:"flex",gap:12,alignItems:"flex-start",marginBottom:6}}><div style={{minWidth:72,color:item.color||C.muted,fontSize:11,fontWeight:800}}>{item.time}</div><div style={{flex:1}}><div style={{color:C.text,fontWeight:700,fontSize:13}}>{item.activity}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{item.detail}</div></div></div>}
        />
      </Card>

      {/* SUBJECT ALLOCATION */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📊 DAILY SUBJECT ALLOCATION</div>
        <ObjList path="subjectAlloc" fields={[{key:"label",label:"Subject"},{key:"time",label:"Time"},{key:"note",label:"Note"},{key:"color",label:"Color (hex)"}]} blank={{label:"New Subject",time:"30m",note:"...",color:C.blue}} addLabel="Add Subject"
          renderRow={(s,i)=>(
            <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.label}</span>
                <span style={{color:s.color||C.muted,fontWeight:800,fontSize:13,background:(s.color||C.muted)+"15",padding:"2px 8px",borderRadius:6}}>{s.time}</span>
              </div>
              <div style={{color:C.muted,fontSize:11,marginTop:3}}>{s.note}</div>
            </div>
          )}
        />
        {/* Total study hours — dynamic */}
        {(()=>{
          const alloc=data.subjectAlloc||[];
          // Parse times like "1h 13m", "55m", "30m", "1h", "20-30m", "30m conditional"
          let totalMin=0;
          alloc.forEach(s=>{
            const t=s.time||"";
            const hMatch=t.match(/(\d+)\s*h/);const mMatch=t.match(/(\d+(?:\.\d+)?)\s*m/);
            const h=hMatch?parseInt(hMatch[1]):0;
            const m=mMatch?Math.round(parseFloat(mMatch[1])):0;
            if(h||m)totalMin+=h*60+m;
          });
          const hrs=Math.floor(totalMin/60);const mins=totalMin%60;
          const label=totalMin>0?(hrs>0?`~${hrs}h ${mins>0?mins+"m ":""}(${alloc.length} slots)`:`~${mins}m (${alloc.length} slots)`):`${alloc.length} subjects`;
          return(
            <div style={{marginTop:12,padding:"10px 12px",background:"rgba(16,185,129,0.08)",border:`1px solid ${C.green}33`,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:12}}>📚 Total Exam Study Time</span>
              <span style={{color:C.green,fontWeight:800,fontSize:14}}>{label}</span>
            </div>
          );
        })()}
      </Card>

      {/* SATURDAY MOCK TEST NIGHT */}
      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>🎯 SATURDAY MOCK TEST NIGHT</div>
        <div style={{background:"rgba(59,130,246,0.08)",border:`1px solid ${C.blue}33`,borderRadius:8,padding:"10px 12px",marginBottom:10,color:C.muted,fontSize:12}}>
          Pura din normal rehnda hai. Sirf dinner thoda early (6:30-7:00 PM) shift hota hai mock room banane layi. Deep analysis Sunday subah hoga — Saturday raat sirf score + quick scan.
          <div style={{marginTop:6,color:C.saffron,fontWeight:700}}>⚡ Mock ton pehle: Surya Nadi (5-10 right-nostril breaths) for alertness.</div>
        </div>
        <ObjList path="mockDaySchedule" fields={[{key:"time",label:"Time"},{key:"activity",label:"Activity"},{key:"detail",label:"Detail",multiline:true}]} blank={{time:"00:00",activity:"New Block",detail:"..."}} addLabel="Add Mock Block"
          renderRow={(item,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.25)",borderRadius:8,padding:"9px 12px",borderLeft:`3px solid ${C.blue}`,marginBottom:6}}>
              <div style={{color:C.blue,fontSize:11,fontWeight:800}}>{item.time}</div>
              <div style={{color:C.text,fontWeight:700,fontSize:13}}>{item.activity}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:2}}>{item.detail}</div>
            </div>
          )}
        />
      </Card>

      {/* NADI ACTIVATION SYSTEM */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>🌬️ NADI ACTIVATION SYSTEM</div>
        {(data.nadiActivation||[]).map((n,i)=>(
          <div key={i} style={{background:n.color+"0d",border:`1px solid ${n.color}33`,borderRadius:10,padding:12,marginBottom:10}}>
            <div style={{color:n.color,fontWeight:700,fontSize:13,marginBottom:4}}>{n.title}</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:8}}>⏰ When: {n.when}</div>
            {(n.methods||[]).map((m,j)=>(
              <div key={j} style={{display:"flex",gap:8,padding:"4px 0",color:C.text,fontSize:12}}>
                <span style={{color:n.color,fontWeight:700}}>•</span><span>{m}</span>
              </div>
            ))}
          </div>
        ))}
      </Card>

      {/* PRE-STUDY RITUAL — quick reference */}
      <Card glow={C.green}>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:10}}>🧘 PRE-STUDY RITUAL (3:25 AM)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(data.preStudyRitual||[]).map((step,i)=>(
            <span key={i} style={{background:C.green+"11",border:`1px solid ${C.green}33`,color:C.text,borderRadius:8,padding:"5px 10px",fontSize:12}}>
              <span style={{color:C.green,fontWeight:800,marginRight:4}}>{i+1}.</span>{step}
            </span>
          ))}
        </div>
      </Card>

      {/* DAILY SCHEDULE COMPLIANCE LOG */}
      <DailyLog
        storagePrefix="schedule-log"
        title="Daily Schedule Compliance"
        color={C.purple}
        fields={[
          {key:"wakeTime",label:"🕐 Wake Time",placeholder:"e.g. 3:00 AM"},
          {key:"studyHrs",label:"📚 Study Hours",type:"number",placeholder:"e.g. 6"},
          {key:"mcqsDone",label:"✅ MCQs Done",type:"number",placeholder:"e.g. 50"},
          {key:"scheduleScore",label:"⭐ Schedule Score /10 (whole number)",type:"number",placeholder:"0–10"},
          {key:"missed",label:"❌ What Was Missed",type:"textarea",placeholder:"Any block missed today?"},
          {key:"note",label:"📝 Day Note",type:"textarea",placeholder:"How was the day overall?"},
        ]}
      />

      {/* MONTHLY SCHEDULE REVIEW */}
      <MonthlyRecord
        storagePrefix="schedule-monthly"
        title="Schedule Monthly Review"
        color={C.purple}
        fields={[
          {key:"avgWakeTime",label:"Avg Wake Time",placeholder:"e.g. 3:10 AM"},
          {key:"daysOnTrack",label:"Days On Schedule (out of 30)",type:"number",placeholder:"e.g. 25"},
          {key:"avgStudyHrs",label:"Avg Daily Study Hours",type:"number",placeholder:"e.g. 5.5"},
          {key:"biggestBlock",label:"Biggest Schedule Blocker",type:"textarea",placeholder:"What broke the schedule most?"},
          {key:"nextFix",label:"Next Month Fix",type:"textarea",placeholder:"What to improve?"},
        ]}
      />
    </div>
  );
}

function StudyTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="📚" title="Study System" sub="Pre-study ritual + protocols + hacks + AFO strategy."/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <SaveSnapshotButton type="daily" label="Study Snapshot" data={data} color={C.green} module="study"/>
        <SaveSnapshotButton type="weekly" label="Weekly Study" data={data} color={C.blue} module="study"/>
      </div>
      <Card glow={C.green}>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:10}}>🧘 PRE-STUDY RITUAL</div>
        <StrList path="preStudyRitual" addLabel="Add Ritual Step"/>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>⏱️ POMODORO PROTOCOL</div>
        <ObjList path="pomodoroProtocol" fields={[{key:"mode",label:"Mode"},{key:"rule",label:"Rule"}]} blank={{mode:"New Mode",rule:"..."}} addLabel="Add Mode"
          renderRow={(p,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.gold,fontWeight:700,fontSize:12}}>{p.mode}</div><div style={{color:C.text,fontSize:12,marginTop:2}}>→ {p.rule}</div></div>}
        />
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>💡 STUDY HACKS</div>
        <ObjList path="studyHacks" fields={[{key:"hack",label:"Hack"},{key:"detail",label:"Detail",multiline:true}]} blank={{hack:"New Hack",detail:"..."}} addLabel="Add Hack"
          renderRow={(h,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.saffron,fontWeight:700,fontSize:12}}>→ {h.hack}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{h.detail}</div></div>}
        />
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📐 SUBJECT RATIOS (New / MCQ / Revision)</div>
        {data.subjectRatios.map((s,i)=>(
          <div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:4}}><span>{s.subject}</span><span style={{color:C.text}}>{s.n}% / {s.m}% / {s.r}%</span></div>
            <div style={{display:"flex",gap:2,height:8,borderRadius:4,overflow:"hidden"}}>
              <div style={{width:s.n+"%",background:C.green}}/>
              <div style={{width:s.m+"%",background:C.blue}}/>
              <div style={{width:s.r+"%",background:C.gold}}/>
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:C.muted}}>
          <span><span style={{color:C.green}}>■</span> New</span>
          <span><span style={{color:C.blue}}>■</span> MCQ</span>
          <span><span style={{color:C.gold}}>■</span> Revision</span>
        </div>
      </Card>
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🃏 ANKI RULES</div>
        <ObjList path="ankiRules" fields={[{key:"rule",label:"Rule"},{key:"detail",label:"Detail"}]} blank={{rule:"New Rule",detail:"..."}} addLabel="Add Anki Rule"
          renderRow={(a,i)=><div style={{padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.gold,fontWeight:700,fontSize:12}}>{a.rule}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{a.detail}</div></div>}
        />
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📚 14-STEP STUDY FRAMEWORK</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(data.studyFramework||[]).map((s,i)=><div key={i} style={{background:C.cardLight,borderRadius:8,padding:"6px 10px",display:"flex",gap:6}}><span style={{color:C.saffron,fontWeight:800,fontSize:11}}>{i+1}</span><span style={{color:C.text,fontSize:12}}>{s}</span></div>)}
        </div>
      </Card>
      <Card style={{background:"rgba(239,68,68,0.05)",border:`1px solid ${C.red}33`}}>
        <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:10}}>🏁 EXAM FINAL PHASE</div>
        <ObjList path="examFinalPhase" fields={[{key:"rule",label:"Rule"},{key:"detail",label:"Detail",multiline:true}]} blank={{rule:"New Rule",detail:"..."}} addLabel="Add Rule"
          renderRow={e=><div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:"#FF8A8A",fontWeight:700,fontSize:12}}>{e.rule}</div><div style={{color:C.text,fontSize:12,marginTop:2}}>{e.detail}</div></div>}
        />
      </Card>
      <Card glow={C.blue}><div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>🏦 AFO PRELIMS STRATEGY</div><StrList path="afoPrelims" addLabel="Add Prelims Point"/></Card>
      <Card glow={C.blue}><div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>🏦 AFO MAINS STRATEGY</div><StrList path="afoMains" addLabel="Add Mains Point"/></Card>
      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10}}>🎯 AFO/ADO/PATWARI TIPS</div>
        <ObjList path="afoTips" fields={[{key:"tip",label:"Tip"},{key:"detail",label:"Detail",multiline:true}]} blank={{tip:"New Tip",detail:"..."}} addLabel="Add Tip"
          renderRow={(t,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.blue,fontWeight:700,fontSize:12}}>{t.tip}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{t.detail}</div></div>}
        />
      </Card>
      <Card><div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🌾 AGRICULTURE COMPLETION RULE</div>
        <StrList path="agriChecklist" addLabel="Add Checklist Item" renderItem={item=><span style={{color:C.text,fontSize:13}}>✅ {item}</span>}/>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🧠 MEMORY METHODS</div>
        <ObjList path="memoryMethods" fields={[{key:"method",label:"Method"},{key:"use",label:"How to use"}]} blank={{method:"New Method",use:"..."}} addLabel="Add Method"
          renderRow={m=><div style={{padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.gold,fontWeight:700,fontSize:13}}>{m.method}: </span><span style={{color:C.muted,fontSize:13}}>{m.use}</span></div>}
        />
      </Card>

      {/* 80/20 FRAMEWORK — from v10 */}
      <Card glow={C.saffron} style={{background:"rgba(255,107,53,0.06)",border:`1px solid ${C.saffron}33`}}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:10,letterSpacing:1}}>📐 80-20 RULE FRAMEWORK</div>
        <div style={{color:C.text,fontSize:13,marginBottom:8}}>{data.eightyTwentyFramework?.main}</div>
        <div style={{background:"rgba(255,107,53,0.1)",border:`1px solid ${C.saffron}33`,borderRadius:8,padding:10}}>
          <div style={{color:"#FF9D5C",fontWeight:700,fontSize:12}}>⚠️ Anti-Overdo Solution:</div>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>{data.eightyTwentyFramework?.antiOverdo}</div>
        </div>
      </Card>

      {/* 7-MIN BREAKDOWN + GPT WORKFLOW — from v10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>⚡ 7-MIN ONE-PAGE BREAKDOWN RULE</div>
        <div style={{background:"rgba(16,185,129,0.1)",border:`1px solid ${C.green}33`,borderRadius:8,padding:10}}>
          <div style={{color:C.green,fontSize:12,fontWeight:700,marginBottom:4}}>Formula:</div>
          <div style={{color:C.text,fontSize:12}}>{data.sevenMinBreakdown}</div>
        </div>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🤖 GPT + ONENOTE + ANKI WORKFLOW</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
          {(data.gptWorkflow||[]).map((step,i,arr)=>(
            <span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{background:"rgba(59,130,246,0.15)",border:`1px solid ${C.blue}33`,color:C.text,borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600}}>{step}</span>
              {i<arr.length-1&&<span style={{color:C.muted}}>→</span>}
            </span>
          ))}
        </div>
      </Card>

      {/* ANKI CHIPS + SPACED REP — from v10 */}
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🎴 ANKI SYSTEM SCHEDULE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {(data.ankiChips||[]).map((t,i)=>(
            <span key={i} style={{background:t.color+"15",border:`1px solid ${t.color}33`,color:t.color,borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:600}}>{t.label}</span>
          ))}
        </div>
        <div style={{color:C.text,fontSize:13,marginBottom:6}}>
          <span style={{color:C.gold,fontWeight:700}}>Spaced Repetition: </span>
          {(data.spacedRepetition||[]).map((d,i,arr)=>(
            <span key={i}><span style={{color:C.teal,fontWeight:700}}>{d}</span>{i<arr.length-1&&<span style={{color:C.muted}}> → </span>}</span>
          ))}
        </div>
        <div style={{color:C.text,fontSize:13}}><span style={{color:C.gold,fontWeight:700}}>Card Formula: </span>Question → Answer → Real Example</div>
      </Card>

      {/* MASTER SUCCESS FORMULA — from v10 */}
      <div style={{background:`linear-gradient(135deg,rgba(10,10,15,0.8),rgba(17,17,34,0.8))`,border:`1px solid ${C.gold}22`,borderRadius:14,padding:16,textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10,letterSpacing:1}}>🏆 MASTER SUCCESS FORMULA</div>
        <div style={{color:C.text,fontSize:12,lineHeight:2,flexWrap:"wrap"}}>
          {(data.masterSuccessFormula||[]).map((step,i,arr)=>(
            <span key={i}>
              <span style={{color:i%3===0?C.saffron:i%3===1?C.gold:C.green,fontWeight:700}}>{step}</span>
              {i<arr.length-1&&<span style={{color:C.muted}}> → </span>}
            </span>
          ))}
        </div>
      </div>

      {/* Daily study log */}
      <DailyLog
        storagePrefix="study-log"
        title="Study Log"
        color={C.green}
        fields={[
          {key:"studyHrs",label:"Study Hours",type:"number",placeholder:"e.g. 6"},
          {key:"mcqs",label:"MCQs Solved",type:"number",placeholder:"e.g. 50"},
          {key:"anki",label:"Anki Cards",type:"number",placeholder:"e.g. 30"},
          {key:"topics",label:"Topics Covered",placeholder:"e.g. Agronomy Ch3"},
          {key:"weakArea",label:"Weak Area Today",placeholder:"e.g. DI problems"},
          {key:"note",label:"Study Note",type:"textarea",placeholder:"What did you learn?"},
        ]}
      />
      {/* Monthly study summary */}
      <MonthlyRecord
        storagePrefix="study-monthly"
        title="Study Summary"
        color={C.purple}
        fields={[
          {key:"syllabusPct",label:"Syllabus % Done",type:"number",placeholder:"e.g. 45"},
          {key:"mockTrend",label:"Mock Score Trend",placeholder:"e.g. 65→72→78"},
          {key:"topicsComplete",label:"Topics Completed",placeholder:"e.g. Agronomy, Arithmetic"},
          {key:"weakTopics",label:"Weak Topics Still",placeholder:"e.g. Forestry, DI"},
          {key:"monthReflection",label:"Month Reflection",type:"textarea",placeholder:"What worked this month?"},
        ]}
      />

      {/* CONSISTENCY PRINCIPLES — from v11 */}
      <Card glow={C.blue} style={{background:"rgba(59,130,246,0.05)"}}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12,letterSpacing:1}}>🔗 CONSISTENCY PRINCIPLES (8 Laws)</div>
        {(data.consistencyPrinciples||[]).map((p,i)=>(
          <div key={i} style={{padding:"8px 0",borderBottom:i<(data.consistencyPrinciples.length-1)?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.text,fontWeight:700,fontSize:13}}>{i+1}. {p.title}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:3,lineHeight:1.5}}>{p.detail}</div>
          </div>
        ))}
      </Card>

      {/* MNEMONIC LIBRARY — from v11 */}
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:12,letterSpacing:1}}>🧠 MNEMONIC LIBRARY (30+ Methods)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {(data.mnemonicLibrary||[]).map((m,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",border:`1px solid ${C.gold}22`,borderRadius:8,padding:10}}>
              <div style={{color:C.gold,fontWeight:700,fontSize:11,marginBottom:6}}>{m.name}</div>
              {(m.steps||[]).map((s,j)=>(
                <div key={j} style={{display:"flex",gap:6,padding:"2px 0"}}>
                  <span style={{color:C.saffron,fontSize:9,fontWeight:700,minWidth:14}}>{j+1}.</span>
                  <span style={{color:C.muted,fontSize:10,lineHeight:1.4}}>{s}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SleepDebtTracker(){
  const[nights,setNights]=useState([7,7]);
  const isAlert=nights.filter(n=>n<7).length>=2;
  return(
    <Card style={{background:isAlert?"rgba(239,68,68,0.08)":"rgba(59,130,246,0.06)",border:`1px solid ${isAlert?C.red+"44":C.blue+"44"}`}}>
      <div style={{fontSize:12,color:isAlert?C.red:C.blue,fontWeight:700,marginBottom:8}}>😴 SLEEP DEBT TRACKER</div>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        {nights.map((n,i)=>(
          <div key={i} style={{flex:1}}>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>{i===0?"2 nights ago":"Last night"}</div>
            <input type="number" step="0.5" value={n} onChange={e=>{const u=nights.slice();u[i]=Number(e.target.value);setNights(u);}} style={{...IS,textAlign:"center",fontSize:14,fontWeight:700,border:`1px solid ${n<7?C.red:"rgba(255,255,255,0.15)"}`}}/>
          </div>
        ))}
      </div>
      {isAlert?<div style={{background:"rgba(239,68,68,0.15)",borderRadius:8,padding:10,color:C.red,fontWeight:700,fontSize:12}}>🚨 2 nights below 7hrs — early sleep override tonight.</div>:<div style={{color:C.green,fontSize:12}}>✅ Sleep on track.</div>}
    </Card>
  );
}

function HealthTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="💪" title="Health & Vitality" sub="Diet + habits + posture + recovery + vitality meals."/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <SaveSnapshotButton type="daily" label="Health Snapshot" data={data} color={C.teal} module="health"/>
        <SaveSnapshotButton type="weekly" label="Weekly Health" data={data} color={C.green} module="health"/>
      </div>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🍽️ DIET PLAN</div>
        <ObjList path="diet" fields={[{key:"icon",label:"Icon"},{key:"meal",label:"Meal"},{key:"food",label:"Food"}]} blank={{icon:"🥗",meal:"New Meal",food:"..."}} addLabel="Add Meal"
          renderRow={(m,i)=><div style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:22}}>{m.icon}</span><div><div style={{color:C.saffron,fontWeight:700,fontSize:12}}>{m.meal}</div><div style={{color:C.text,fontSize:13,marginTop:2}}>{m.food}</div></div></div>}
        />
        {/* 50-25-25 RULE VISUAL — from v10 */}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          {[[C.green,"50%","Food (solid)"],[C.blue,"25%","Water (liquid)"],[C.saffron,"25%","Empty (air)"]].map(([col,pct,lbl],i)=>(
            <div key={i} style={{flex:1,background:col+"11",border:`1px solid ${col}33`,borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{color:col,fontWeight:700,fontSize:18}}>{pct}</div>
              <div style={{color:C.muted,fontSize:11}}>{lbl}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,color:C.muted,fontSize:12,textAlign:"center"}}>💧 Water: 3-4 Litres daily | Every 30 min | Copper/clay vessel preferred</div>
      </Card>
      <Card glow={C.green}>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:10}}>✅ DAILY HEALTH HABITS</div>
        <StrList path="healthHabits" addLabel="Add Habit"/>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>⚡ VITALITY MEALS</div>
        <StrList path="vitalityMeals" addLabel="Add Vitality Meal"/>
      </Card>
      {/* YOGIC BREATHING — from v10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>🌬️ YOGIC BREATHING SYSTEM</div>
        <div style={{color:C.text,fontSize:13,marginBottom:8}}>
          <span style={{color:C.blue,fontWeight:700}}>Navel-Centric (ਨਾਭੀ) Breathing:</span> Saah nu naabhi ton operate karo.
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
          {["Belly","Ribs","Chest"].map((step,i)=>(
            <span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{background:"rgba(59,130,246,0.15)",border:`1px solid ${C.blue}33`,color:C.text,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:600}}>{step}</span>
              {i<2&&<span style={{color:C.blue}}>→</span>}
            </span>
          ))}
        </div>
        <div style={{color:C.muted,fontSize:12}}>Use before study sessions, after Pomodoros, during stress, before sleep — Belly → Ribs → Chest (4s in, 4s out)</div>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🪑 POSTURE RULES</div>
        <div style={{background:`rgba(255,107,53,0.1)`,border:`1px solid ${C.saffron}33`,borderRadius:8,padding:"8px 12px",marginBottom:10,textAlign:"center"}}>
          <span style={{color:C.saffron,fontWeight:800,fontSize:13}}>Master Rule: Chin → Chest → Core</span>
        </div>
        <ObjList path="posture" fields={[{key:"sit",label:"Situation"},{key:"rule",label:"Rule",multiline:true}]} blank={{sit:"New Situation",rule:"..."}} addLabel="Add Posture Rule"
          renderRow={(p,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.gold,fontWeight:700,fontSize:12}}>{p.sit}</div><div style={{color:C.text,fontSize:12,marginTop:2}}>→ {p.rule}</div></div>}
        />
      </Card>
      <Card glow={C.purple}>
        <div style={{fontSize:12,color:C.purple,fontWeight:700,marginBottom:10}}>🌸 VITALITY & SEXUAL HEALTH</div>
        <ObjList path="sexHealth" fields={[{key:"item",label:"Item"},{key:"detail",label:"Detail",multiline:true}]} blank={{item:"New Item",detail:"..."}} addLabel="Add Item"
          renderRow={(s,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.purple,fontWeight:700,fontSize:12}}>{s.item}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{s.detail}</div></div>}
        />
      </Card>
      {/* HEALTH = EMBEDDED PHILOSOPHY — from v10 */}
      <Card glow={C.green} style={{background:"rgba(16,185,129,0.05)"}}>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:8,letterSpacing:1}}>♻️ HEALTH = EMBEDDED, NOT SEPARATE</div>
        <div style={{color:C.text,fontSize:13,lineHeight:1.7}}>{data.healthPhilosophy}</div>
      </Card>
      <SleepDebtTracker/>
      {/* Daily health log */}
      <DailyLog
        storagePrefix="health-log"
        title="Health Log"
        color={C.green}
        fields={[
          {key:"water",label:"Water (Litres)",type:"number",placeholder:"e.g. 3.5"},
          {key:"sleep",label:"Sleep Hours",type:"number",placeholder:"e.g. 5.5"},
          {key:"napDone",label:"Nap Done?",placeholder:"Yes / No"},
          {key:"exercise",label:"Exercise Done",placeholder:"e.g. Running 15min + Pushups"},
          {key:"meditation",label:"Meditation",placeholder:"Morning + Evening?"},
          {key:"energyLevel",label:"Energy Level /10",type:"number",placeholder:"e.g. 7"},
          {key:"note",label:"Health Note",type:"textarea",placeholder:"How did body feel?"},
        ]}
      />
      <MonthlyRecord
        storagePrefix="health-monthly"
        title="Health Summary"
        color={C.teal}
        fields={[
          {key:"weight",label:"Weight (kg)",type:"number",placeholder:"e.g. 68"},
          {key:"avgEnergy",label:"Avg Energy /10",type:"number",placeholder:"e.g. 7"},
          {key:"habitRating",label:"Habit Consistency /10",type:"number",placeholder:"e.g. 8"},
          {key:"improvements",label:"Health Improvements",type:"textarea",placeholder:"What improved this month?"},
          {key:"nextTarget",label:"Next Month Health Target",type:"textarea",placeholder:"e.g. Add 10 pushups daily"},
        ]}
      />
      {/* ── ENERGY + MOOD + STRESS DASHBOARD ── */}
      <DailyLog
        storagePrefix="ems-dashboard"
        title="⚡ Energy · Mood · Stress Dashboard"
        color={C.teal}
        fields={[
          {key:"energy",label:"Energy Level /10",type:"number",placeholder:"1 = depleted · 10 = peak"},
          {key:"mood",label:"Mood /10",type:"number",placeholder:"1 = very low · 10 = amazing"},
          {key:"stress",label:"Stress Level /10",type:"number",placeholder:"1 = totally calm · 10 = overwhelmed"},
          {key:"sleepQuality",label:"Sleep Quality /10",type:"number",placeholder:"1 = terrible · 10 = deep & refreshed"},
          {key:"bodyFeeling",label:"How does the body feel?",placeholder:"e.g. tight shoulders, light legs, sharp mind..."},
          {key:"trigger",label:"Today's Main Stressor (if any)",placeholder:"e.g. missed a topic, social pressure, poor sleep..."},
          {key:"reset",label:"Reset used?",placeholder:"e.g. 10 min walk, breathing, nap, journaling..."},
        ]}
      />
      {/* ── BURNOUT MONITOR ── */}
      <DailyLog
        storagePrefix="burnout-monitor"
        title="🔥 Burnout Monitor"
        color={C.red}
        fields={[
          {key:"score",label:"Burnout Risk Score /10",type:"number",placeholder:"1 = fully recharged · 10 = near collapse"},
          {key:"signs",label:"Warning Signs Noticed",type:"textarea",placeholder:"e.g. brain fog, irritability, zero motivation, physical fatigue, dread of study..."},
          {key:"consecutive",label:"Consecutive Hard Days (no recovery)",type:"number",placeholder:"e.g. 4 (trigger: ≥5 = mandatory recovery day)"},
          {key:"action",label:"Recovery Action Taken / Planned",type:"textarea",placeholder:"e.g. took a nap, skipped screen, 20 min walk, declared Emergency Min Day..."},
        ]}
      />
      <Card glow={C.red} style={{background:"rgba(239,68,68,0.05)"}}>
        <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:12,letterSpacing:1}}>🚨 BURNOUT ALERT THRESHOLDS</div>
        {[
          {score:"1–3",label:"🟢 Recharged",action:"Full execution mode. Push hard."},
          {score:"4–5",label:"🟡 Watch",action:"Add 1 extra recovery block. Protect sleep."},
          {score:"6–7",label:"🟠 Caution",action:"Reduce scope. Emergency Min protocol."},
          {score:"8–9",label:"🔴 Danger",action:"Mandatory half-day off. No guilt. Recharge first."},
          {score:"10",label:"💀 Collapse Risk",action:"Full recovery day. Sleep, walk, eat well. Zero screens."},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
            <div style={{background:"rgba(255,255,255,0.06)",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,color:C.text,flexShrink:0,minWidth:36,textAlign:"center"}}>{r.score}</div>
            <div>
              <div style={{color:C.text,fontWeight:700,fontSize:12}}>{r.label}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:1}}>{r.action}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function MoneyTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="💰" title="Money & Big Goals" sub="Jars + savings + Mahindra goal + big life goals."/>
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:12}}>🏎️ MAHINDRA GOAL TRACKER</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[
            {label:"Target Price",key:"mahindraTarget",prefix:"₹"},
            {label:"Trade-In Value",key:"tradeInValue",prefix:"₹"},
            {label:"Currently Saved",key:"currentSaved",prefix:"₹"},
          ].map(f=>(
            <div key={f.key} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:10}}>
              <div style={{color:C.muted,fontSize:10,marginBottom:4}}>{f.label}</div>
              <div style={{color:C.gold,fontWeight:900,fontSize:18}}>{f.prefix||""}<ET value={String(data[f.key]||"")} onChange={v=>set(f.key,v)} style={{color:C.gold}}/></div>
            </div>
          ))}
          <div style={{background:"rgba(16,185,129,0.1)",borderRadius:8,padding:10}}>
            <div style={{color:C.muted,fontSize:10,marginBottom:4}}>Still Needed</div>
            <div style={{color:C.green,fontWeight:900,fontSize:18}}>₹{Math.max(0,(Number(data.mahindraTarget)||0)-(Number(data.tradeInValue)||0)-(Number(data.currentSaved)||0)).toLocaleString()}</div>
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{color:C.muted,fontSize:10,marginBottom:3}}>Deadline</div>
          <ET value={data.mahindraDeadline||""} onChange={v=>set("mahindraDeadline",v)} placeholder="e.g. December 2026" style={{color:C.text,fontSize:13}}/>
        </div>
        {/* Progress bar */}
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginTop:8}}>
          <div style={{height:"100%",width:Math.min(100,Math.round(((Number(data.currentSaved)||0)+(Number(data.tradeInValue)||0))/(Number(data.mahindraTarget)||1)*100))+"%",background:`linear-gradient(90deg,${C.gold},${C.green})`}}/>
        </div>
        <div style={{color:C.muted,fontSize:11,marginTop:4,textAlign:"right"}}>{Math.min(100,Math.round(((Number(data.currentSaved)||0)+(Number(data.tradeInValue)||0))/(Number(data.mahindraTarget)||1)*100))}% of goal</div>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🫙 MONTHLY JAR SYSTEM</div>
        <ObjList path="moneyJars" fields={[{key:"jar",label:"Jar Name"},{key:"amount",label:"Monthly Amount"},{key:"rule",label:"Rule"},{key:"color",label:"Color (hex)"}]} blank={{jar:"New Jar",amount:"₹0",rule:"Purpose...",color:C.blue}} addLabel="Add Jar"
          renderRow={(j,i)=><div style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><div style={{width:10,height:10,borderRadius:"50%",background:j.color||C.muted,marginTop:4,flexShrink:0}}/><div style={{flex:1}}><div style={{color:C.text,fontWeight:700,fontSize:13}}>{j.jar}: <span style={{color:j.color||C.gold}}>{j.amount}</span></div><div style={{color:C.muted,fontSize:11,marginTop:1}}>{j.rule}</div></div></div>}
        />
      </Card>
      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10}}>🎯 BIG LIFE GOALS</div>
        <ObjList path="bigGoals" fields={[{key:"goal",label:"Goal"},{key:"targetAmount",label:"Target/Amount"},{key:"deadline",label:"Deadline"},{key:"progress",label:"Progress (%)",type:"number"},{key:"notes",label:"Notes",multiline:true}]} blank={{goal:"New Goal",targetAmount:"",deadline:"",progress:0,notes:""}} addLabel="Add Big Goal"
          renderRow={(g,i)=><div style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.blue,fontWeight:800,fontSize:13}}>{g.goal}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{g.targetAmount} • {g.deadline||"No deadline set"}</div><div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:(Math.min(100,Number(g.progress)||0))+"%",background:C.blue}}/></div><div style={{color:C.muted,fontSize:10,marginTop:3}}>{g.progress||0}% complete</div>{g.notes&&<div style={{color:C.muted,fontSize:11,marginTop:4}}>{g.notes}</div>}</div>}
        />
      </Card>

      {/* INCOME BREAKDOWN — from v10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:8,letterSpacing:1}}>📊 INCOME BREAKDOWN</div>
        {[
          {label:"Total Income",val:`₹${(data.incomeBreakdown?.total||8000).toLocaleString()}`,col:C.gold},
          {label:"Fixed (Petrol + Grooming)",val:`– ₹${(data.incomeBreakdown?.fixed||3080).toLocaleString()}`,col:C.red},
          {label:"Net Available",val:`₹${(data.incomeBreakdown?.net||4920).toLocaleString()}`,col:C.green,bold:true},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:`${i===2?"8px 0 0":"4px 0"}`,borderTop:i===2?`1px solid ${C.border}`:"none",marginTop:i===2?6:0}}>
            <span style={{color:r.bold?C.text:C.muted,fontSize:13,fontWeight:r.bold?700:400}}>{r.label}</span>
            <span style={{color:r.col,fontWeight:r.bold?800:700,fontSize:r.bold?14:13}}>{r.val}</span>
          </div>
        ))}
      </Card>

      {/* BHUA JAR — from v10 */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>🏹 BHUA JAR (₹50,000 — STRICT NO-TOUCH)</div>
        <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"10px",marginBottom:10}}>
          <div style={{color:C.red,fontWeight:700,fontSize:13}}>⚠️ Ultra-strict no-touch fund. Return with full respect by December 2027.</div>
        </div>
        {[
          {label:"Total Given",val:`₹${(data.bhuaJar?.total||50000).toLocaleString()}`},
          {label:"Used",val:`₹${(data.bhuaJar?.used||2000).toLocaleString()}`,col:C.red},
          {label:"Active Balance",val:`₹${(data.bhuaJar?.balance||48000).toLocaleString()}`,col:C.green,bold:true},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:i===2?"6px 0 0":"4px 0",borderTop:i===2?`1px solid ${C.border}`:"none",marginTop:i===2?6:0}}>
            <span style={{color:C.muted,fontSize:13}}>{r.label}</span>
            <span style={{color:r.col||C.text,fontWeight:r.bold?800:700,fontSize:r.bold?14:13}}>{r.val}</span>
          </div>
        ))}
      </Card>

      {/* Monthly money log */}
      <MonthlyRecord
        storagePrefix="money-monthly"
        title="Money Tracker"
        color={C.gold}
        fields={[
          {key:"income",label:"Total Income (₹)",type:"number",placeholder:"e.g. 15000"},
          {key:"expenses",label:"Total Expenses (₹)",type:"number",placeholder:"e.g. 6000"},
          {key:"saved",label:"Amount Saved (₹)",type:"number",placeholder:"e.g. 9000"},
          {key:"mahindraTotal",label:"Mahindra Fund Total (₹)",type:"number",placeholder:"e.g. 120000"},
          {key:"note",label:"Finance Note",type:"textarea",placeholder:"Any big expense? Goal update?"},
        ]}
      />
    </div>
  );
}

// ─── MOCK SCORE TRENDLINE CHART (from v15) ───────────────────────────────────
function MockChart(){
  const[scores,setScores]=useState([65,68,72,75]);
  const[cutoff,setCutoff]=useState(78);
  const updScore=(i,v)=>{const u=scores.slice();u[i]=Number(v);setScores(u);};
  const maxV=Math.max(...scores,cutoff)+10,minV=Math.max(0,Math.min(...scores,cutoff)-10);
  const range=maxV-minV||1,H=140,W=100;
  const pts=scores.map((s,i)=>{const x=scores.length>1?(i/(scores.length-1))*W:W/2;const y=H-((s-minV)/range)*H;return`${x},${y}`;}).join(" ");
  const cy=H-((cutoff-minV)/range)*H;
  const gap=scores[scores.length-1]-cutoff;
  const vel=scores.length>1?(scores[scores.length-1]-scores[0])/(scores.length-1):0;
  return(
    <Card>
      <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:4}}>📈 MOCK SCORE TRENDLINE</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,background:"rgba(0,0,0,0.2)",borderRadius:8}}>
        <line x1="0" y1={cy} x2={W} y2={cy} stroke={C.saffron} strokeWidth="0.6" strokeDasharray="2,2"/>
        <polyline points={pts} fill="none" stroke={C.green} strokeWidth="1.2"/>
        {scores.map((s,i)=>{const x=scores.length>1?(i/(scores.length-1))*W:W/2;const y=H-((s-minV)/range)*H;return<circle key={i} cx={x} cy={y} r="1.5" fill={C.gold}/>;}) }
      </svg>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
        {scores.map((s,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <span style={{color:C.muted,fontSize:9}}>Wk{i+1}</span>
            <input type="number" value={s} onChange={e=>updScore(i,e.target.value)} style={{width:44,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.border}`,borderRadius:6,padding:4,color:C.text,fontSize:11,textAlign:"center"}}/>
          </div>
        ))}
        <div style={{display:"flex",gap:4,alignSelf:"flex-end"}}>
          <button onClick={()=>setScores([...scores,scores[scores.length-1]||0])} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>+wk</button>
          {scores.length>1&&<button onClick={()=>setScores(scores.slice(0,-1))} style={{background:"#FF000022",border:"1px solid #FF000044",color:C.red,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>-wk</button>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
        <span style={{color:C.muted,fontSize:11}}>Cutoff:</span>
        <input type="number" value={cutoff} onChange={e=>setCutoff(Number(e.target.value))} style={{width:50,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.border}`,borderRadius:6,padding:4,color:C.text,fontSize:11,textAlign:"center"}}/>
      </div>
      <div style={{marginTop:8,padding:10,background:gap>=0?C.green+"11":"rgba(255,107,53,0.1)",borderRadius:8}}>
        <div style={{color:gap>=0?C.green:"#FF9D5C",fontWeight:700,fontSize:13}}>{gap>=0?`✅ ${gap} above cutoff`:`⚠️ ${Math.abs(gap)} below cutoff`}</div>
        <div style={{color:C.muted,fontSize:11,marginTop:4}}>Velocity: {vel>0?"+":""}{vel.toFixed(1)}/week</div>
      </div>
    </Card>
  );
}


function TrackerTab(){
  const TRACKER_SUBJECTS={"General Knowledge":C.purple,"Quant":C.gold,"Agriculture":C.green,"English":C.pink,"Computer":C.saffron,"Punjabi":C.teal,"Reasoning":C.blue,"Current Affairs":"#FF5722","Other":C.muted};
  // ── helpers defined BEFORE useState so initializer can call them ──
  function mkRow(){return{id:Date.now()+Math.random(),time:"",subject:"General Knowledge",notes:"",done:false,remarks:""};}
  function wkStats(w){let t=0,d=0;w.days.forEach(day=>day.rows.forEach(r=>{if(r.time||r.notes){t++;if(r.done)d++;}}));return{total:t,done:d,pct:t>0?Math.round(d/t*100):0};}
  function mkInitWeek(){return{weekLabel:"",days:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day=>({day,rows:[mkRow()]})),monthlyTargets:{"Agriculture":"","Quant":"","Reasoning":"","English":"","Computer":"","Punjab GK":"","Current Affairs":"","Punjabi":"","Other":""}};}

  const[week,setWeek]=useState(mkInitWeek);
  const[saved,setSaved]=useState([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[cmpIds,setCmpIds]=useState(["",""]);
  const[view,setView]=useState("edit");

  const loadAll=async()=>{setLoading(true);const keys=await stList("week:");const loaded=[];for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}loaded.sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));setSaved(loaded);setLoading(false);};
  useEffect(()=>{loadAll();},[]);
  const updRow=(di,ri,field,val)=>setWeek(w=>({...w,days:w.days.map((d,i)=>i!==di?d:{...d,rows:d.rows.map((r,j)=>j!==ri?r:{...r,[field]:val})})}));
  const addRow=di=>setWeek(w=>({...w,days:w.days.map((d,i)=>i!==di?d:{...d,rows:[...d.rows,mkRow()]})}));
  const remRow=(di,ri)=>setWeek(w=>({...w,days:w.days.map((d,i)=>{if(i!==di)return d;const nr=d.rows.filter((_,j)=>j!==ri);return{...d,rows:nr.length?nr:[mkRow()]};})}));
  const updateMonthlyTarget=(subj,val)=>setWeek(w=>({...w,monthlyTargets:{...(w.monthlyTargets||{}),[subj]:val}}));
  const saveWeek=async()=>{setSaving(true);const id="week:"+(week.weekLabel||"Week-"+Date.now());await stSet(id,{...week,id,savedAt:Date.now()});await loadAll();setSaving(false);};
  const cs=wkStats(week);
  return(
    <div>
      <SectionTitle icon="📋" title="Weekly Table Tracker" sub="Save each week. Compare any two weeks."/>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["edit","✏️ Edit",C.saffron],["history",`🗂️ Saved (${saved.length})`,C.blue],["compare","⚖️ Compare",C.green]].map(([id,label,col])=>(
          <button key={id} onClick={()=>setView(id)} style={{flex:1,padding:9,borderRadius:8,border:"none",background:view===id?col:"rgba(255,255,255,0.06)",color:view===id?"#fff":C.muted,fontWeight:700,cursor:"pointer",fontSize:11}}>{label}</button>
        ))}
      </div>
      {view==="edit"&&(
        <div>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontSize:11,fontWeight:700,marginBottom:4}}>Week Label</div>
            <input style={IS} placeholder="e.g. Week 1 — Jun 15-21" value={week.weekLabel} onChange={e=>setWeek({...week,weekLabel:e.target.value})}/>
          </Card>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{color:C.muted,fontSize:11}}>Completion</div><div style={{color:C.text,fontSize:20,fontWeight:800}}>{cs.done}/{cs.total} <span style={{color:C.green,fontSize:14}}>({cs.pct}%)</span></div></div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveWeek} disabled={saving} style={{background:C.green,color:"#fff",border:"none",borderRadius:8,padding:"10px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{saving?"...":"💾 Save"}</button>
                <button onClick={()=>setWeek(mkInitWeek())} style={{background:"rgba(255,255,255,0.06)",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🆕 New</button>
              </div>
            </div>
          </Card>
          {/* MONTHLY TARGETS PER SUBJECT */}
          <Card glow={C.blue}>
            <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10,letterSpacing:1}}>🎯 MONTHLY TARGETS (Per Subject)</div>
            {Object.keys(week.monthlyTargets||{}).map(subj=>(
              <div key={subj} style={{marginBottom:8}}>
                <div style={{color:C.muted,fontSize:11,fontWeight:700,marginBottom:3}}>{subj}</div>
                <input style={{...IS,fontSize:12}} placeholder={`${subj} target + time allocation...`} value={(week.monthlyTargets||{})[subj]||""} onChange={e=>updateMonthlyTarget(subj,e.target.value)}/>
              </div>
            ))}
          </Card>
          {week.days.map((d,di)=>(
            <Card key={di}>
              <div style={{fontSize:13,color:C.saffron,fontWeight:800,marginBottom:10}}>📌 {d.day}</div>
              {d.rows.map((row,ri)=>{
                const sc=TRACKER_SUBJECTS[row.subject]||C.muted;
                return(
                  <div key={row.id} style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:10,borderLeft:`3px solid ${sc}`,marginBottom:10}}>
                    <div style={{display:"flex",gap:6,marginBottom:6}}>
                      <input style={{...IS,flex:1}} placeholder="Time" value={row.time} onChange={e=>updRow(di,ri,"time",e.target.value)}/>
                      <select style={{...IS,flex:1}} value={row.subject} onChange={e=>updRow(di,ri,"subject",e.target.value)}>{Object.keys(TRACKER_SUBJECTS).map(s=><option key={s} style={{background:"#1a1a2e"}}>{s}</option>)}</select>
                    </div>
                    <textarea style={{...IS,minHeight:44,resize:"vertical",marginBottom:6}} placeholder="Notes" value={row.notes} onChange={e=>updRow(di,ri,"notes",e.target.value)}/>
                    <textarea style={{...IS,minHeight:32,resize:"vertical",marginBottom:6}} placeholder="Remarks for Improvement..." value={row.remarks} onChange={e=>updRow(di,ri,"remarks",e.target.value)}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div onClick={()=>updRow(di,ri,"done",!row.done)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                        <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${row.done?C.green:"rgba(255,255,255,0.3)"}`,background:row.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{row.done&&<span style={{color:"#fff",fontSize:10,fontWeight:800}}>✓</span>}</div>
                        <span style={{color:row.done?C.green:C.muted,fontSize:11,fontWeight:600}}>{row.done?"Done":"Pending"}</span>
                      </div>
                      <button onClick={()=>remRow(di,ri)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>Remove</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={()=>addRow(di)} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:8,fontSize:12,cursor:"pointer",fontWeight:700,width:"100%"}}>+ Add Block</button>
            </Card>
          ))}
        </div>
      )}
      {view==="history"&&(
        <div>
          {loading&&<Card><div style={{color:C.muted,fontSize:12}}>Loading...</div></Card>}
          {!loading&&saved.length===0&&<Card><div style={{color:C.muted,fontSize:12}}>No weeks saved yet.</div></Card>}
          {saved.slice().reverse().map((w,i)=>{const s=wkStats(w);return(
            <Card key={w.id||i}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{color:C.text,fontWeight:700,fontSize:13}}>{w.weekLabel||"Untitled"}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{s.done}/{s.total} ({s.pct}%)</div></div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{setWeek(w);setView("edit");}} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:6,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>Open</button>
                  <button onClick={async()=>{await stDel(w.id);await loadAll();}} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:6,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>Del</button>
                </div>
              </div>
            </Card>
          );})}
        </div>
      )}
      {view==="compare"&&(
        <div>
          <Card>
            <div style={{display:"flex",gap:8}}>
              {[0,1].map(slot=>(
                <select key={slot} value={cmpIds[slot]} onChange={e=>{const u=cmpIds.slice();u[slot]=e.target.value;setCmpIds(u);}} style={{...IS,flex:1}}>
                  <option value="">Week {slot+1}</option>
                  {saved.map((w,i)=><option key={i} value={w.id} style={{background:"#1a1a2e"}}>{w.weekLabel||"Untitled"}</option>)}
                </select>
              ))}
            </div>
          </Card>
          {cmpIds[0]&&cmpIds[1]&&(()=>{
            const wA=saved.find(w=>w.id===cmpIds[0]),wB=saved.find(w=>w.id===cmpIds[1]);
            if(!wA||!wB)return null;
            const sA=wkStats(wA),sB=wkStats(wB);
            return(<Card><div style={{display:"flex",gap:10}}><div style={{flex:1,textAlign:"center",padding:10,background:C.blue+"11",borderRadius:8}}><div style={{color:C.blue,fontWeight:700,fontSize:12}}>{wA.weekLabel}</div><div style={{color:C.text,fontSize:22,fontWeight:800}}>{sA.pct}%</div></div><div style={{flex:1,textAlign:"center",padding:10,background:C.green+"11",borderRadius:8}}><div style={{color:C.green,fontWeight:700,fontSize:12}}>{wB.weekLabel}</div><div style={{color:C.text,fontSize:22,fontWeight:800}}>{sB.pct}%</div></div></div><div style={{marginTop:10,textAlign:"center",color:sB.pct>=sA.pct?C.green:C.red,fontWeight:700,fontSize:13}}>{sB.pct>=sA.pct?"📈":"📉"} {Math.abs(sB.pct-sA.pct)}% {sB.pct>=sA.pct?"improvement":"decline"}</div></Card>);
          })()}
        </div>
      )}
    </div>
  );
}

function ProgressTab(){
  const{data,set}=useEC();
  const[scores,setScores]=useState({});
  const[mockHistory,setMockHistory]=useState([]);
  const[mockInput,setMockInput]=useState("");
  const[mockDate,setMockDate]=useState(todayStr());

  useEffect(()=>{
    stGet("scorecard:today").then(v=>{if(v)setScores(v.scores||{});});
    stList("mock:").then(async keys=>{
      const loaded=[];for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
      loaded.sort((a,b)=>a.date>b.date?-1:1);
      setMockHistory(loaded);
    });
  },[]);

  const tasks=data.summer60||[];
  const total=tasks.reduce((s,t)=>s+(Number(scores[t.id])||0),0);
  const maxTotal=tasks.reduce((s,t)=>s+Number(t.max),0);
  // FIX: 100% means 100 — show actual score out of max
  const pct=maxTotal>0?Math.round((total/maxTotal)*100):0;

  const saveDayScore=async()=>{
    await stSet("scorecard:today",{scores,savedAt:Date.now()});
    // Save to monthly record
    const entry={date:todayStr(),scores,total,maxTotal,pct,savedAt:Date.now()};
    await stSet("scorecard:"+todayStr(),entry);
  };

  const addMock=async()=>{
    if(!mockInput)return;
    const entry={date:mockDate,score:Number(mockInput),id:"mock:"+Date.now()};
    await stSet(entry.id,entry);
    const keys=await stList("mock:");
    const loaded=[];for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}
    loaded.sort((a,b)=>a.date>b.date?-1:1);
    setMockHistory(loaded);
    setMockInput("");
  };

  return(
    <div>
      <SectionTitle icon="📊" title="Progress & Scorecard" sub="Daily scorecard + mock scores + milestones + subject progress."/>

      {/* SCORECARD — Fixed: 100% = 100 */}
      <Card glow={pct>=80?C.green:pct>=50?C.gold:C.red} style={{textAlign:"center",padding:28}}>
        <div style={{color:C.muted,fontSize:12,marginBottom:6}}>TODAY'S SCORE</div>
        <div style={{fontSize:60,fontWeight:900,color:pct>=80?C.green:pct>=50?C.gold:C.red}}>{total}<span style={{fontSize:24,color:C.muted}}>/{maxTotal}</span></div>
        <div style={{fontSize:20,color:C.muted,marginBottom:12}}>{pct}%</div>
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",maxWidth:280,margin:"0 auto 12px"}}>
          <div style={{width:pct+"%",height:"100%",background:pct>=80?C.green:pct>=50?C.gold:C.red,transition:"width 0.5s"}}/>
        </div>
        <button onClick={saveDayScore} style={{background:C.gold,color:"#000",border:"none",borderRadius:8,padding:"10px 20px",fontWeight:800,cursor:"pointer",fontSize:12}}>💾 Save Today's Score</button>
      </Card>

      {/* Score tasks — editable max values */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:12}}>⭐ SCORECARD TASKS</div>
        <ObjList path="summer60" fields={[{key:"icon",label:"Icon"},{key:"phase",label:"Phase"},{key:"time",label:"Time"},{key:"how",label:"How"},{key:"max",label:"Max Points"}]} blank={{id:"new"+Date.now(),icon:"⭐",phase:"New Phase",time:"",how:"...",max:5}} addLabel="Add Task"
          renderRow={(t,i)=>(
            <div style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:20,minWidth:28}}>{t.icon}</span>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontWeight:700,fontSize:12}}>{t.phase}</div>
                <div style={{color:C.muted,fontSize:10,marginTop:1}}>{t.time}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" min={0} max={t.max} value={Number(scores[t.id])||0}
                  onChange={e=>setScores({...scores,[t.id]:Math.min(Number(t.max),Math.max(0,Number(e.target.value)))})}
                  style={{width:44,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.gold}44`,color:C.gold,borderRadius:6,padding:5,textAlign:"center",fontWeight:800,outline:"none"}}/>
                <span style={{color:C.muted,fontSize:11}}>/{t.max}</span>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Mock score tracker with monthly history */}
      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10}}>📈 MOCK SCORE LOG</div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          <input type="number" style={{...IS,flex:2}} placeholder="Score (e.g. 75)" value={mockInput} onChange={e=>setMockInput(e.target.value)}/>
          <input type="date" style={{...IS,flex:2}} value={mockDate} onChange={e=>setMockDate(e.target.value)}/>
          <button onClick={addMock} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",fontSize:12}}>+ Add</button>
        </div>
        {mockHistory.length>0&&(
          <div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:8}}>
              {mockHistory.slice(-10).map((m,i)=>{
                const max=Math.max(...mockHistory.map(x=>x.score))||100;
                return(
                  <div key={i} style={{flex:1,background:`linear-gradient(0deg,${C.blue}40,${C.blue})`,height:((m.score/max)*75+5)+"px",borderRadius:"3px 3px 0 0",display:"flex",justifyContent:"center",position:"relative"}}>
                    <span style={{position:"absolute",top:-16,color:C.text,fontSize:10,fontWeight:700}}>{m.score}</span>
                  </div>
                );
              })}
            </div>
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {mockHistory.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.muted,fontSize:11}}>{m.date}</span>
                  <span style={{color:C.blue,fontWeight:700,fontSize:12}}>{m.score}</span>
                  <button onClick={async()=>{await stDel(m.id);const keys=await stList("mock:");const loaded=[];for(const k of keys){const v=await stGet(k);if(v)loaded.push(v);}loaded.sort((a,b)=>a.date>b.date?-1:1);setMockHistory(loaded);}} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:4,padding:"2px 6px",fontSize:9,cursor:"pointer"}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Subject progress — editable */}
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:12}}>📚 SUBJECT PROGRESS</div>
        {(data.subjectProgress||[]).map((s,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{color:C.text,fontSize:13}}>{s.subject}</span>
              <span style={{color:C.gold,fontWeight:700,fontSize:13}}>{s.pct}%</span>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="range" min={0} max={100} value={s.pct}
                onChange={e=>set("subjectProgress",(data.subjectProgress||[]).map((x,j)=>j===i?{...x,pct:Number(e.target.value)}:x))}
                style={{flex:1,accentColor:C.saffron}}/>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",marginTop:4}}>
              <div style={{height:"100%",width:s.pct+"%",background:`linear-gradient(90deg,${C.saffron},${C.gold})`,transition:"width 0.3s"}}/>
            </div>
            <div style={{marginTop:4}}>
              <ET value={s.weakTopics} onChange={v=>set("subjectProgress",(data.subjectProgress||[]).map((x,j)=>j===i?{...x,weakTopics:v}:x))} placeholder="Weak topics..." style={{color:C.muted,fontSize:11}}/>
            </div>
          </div>
        ))}
      </Card>

      {/* Milestones — fully editable */}
      <Card glow={C.saffron}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:10}}>🏆 MILESTONES</div>
        {(data.milestones||[]).map((m,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <div onClick={()=>set("milestones",(data.milestones||[]).map((x,j)=>j===i?{...x,done:!x.done}:x))}
              style={{width:20,height:20,borderRadius:6,border:`2px solid ${m.done?C.green:C.border}`,background:m.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              {m.done&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
            </div>
            <ET value={m.label} onChange={v=>set("milestones",(data.milestones||[]).map((x,j)=>j===i?{...x,label:v}:x))} style={{color:m.done?C.green:C.text,fontSize:13,textDecoration:m.done?"line-through":"none",flex:1}}/>
          </div>
        ))}
        {useEC().em&&<button onClick={()=>set("milestones",[...(data.milestones||[]),{label:"New Milestone",done:false}])} style={{marginTop:8,background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>+ Add Milestone</button>}
      </Card>

      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10}}>🎯 REVISION TARGETS PER SUBJECT</div>
        {(data.revisionTargets||[]).map((r,i)=>(
          <div key={i} style={{marginBottom:8}}>
            <div style={{color:C.text,fontSize:12,fontWeight:600,marginBottom:3}}>{r.subject}</div>
            <input style={IS} placeholder="Revision target..." value={r.target||""} onChange={e=>set("revisionTargets",(data.revisionTargets||[]).map((x,j)=>j===i?{...x,target:e.target.value}:x))}/>
          </div>
        ))}
      </Card>

      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:8}}>📝 STRENGTH & WEAKNESS NOTE</div>
        <textarea style={{...IS,minHeight:80,resize:"vertical"}} placeholder={"Strong areas: ...\nWeak areas: ...\nThis week priority: ..."} value={data.strengthWeakNote||""} onChange={e=>set("strengthWeakNote",e.target.value)}/>
      </Card>

      <MonthlyRecord
        storagePrefix="progress-monthly"
        title="Progress Summary"
        color={C.saffron}
        fields={[
          {key:"avgScore",label:"Avg Scorecard Score",type:"number",placeholder:"e.g. 78"},
          {key:"bestMock",label:"Best Mock Score",placeholder:"e.g. 82/100"},
          {key:"syllabusDone",label:"Syllabus % Done",type:"number",placeholder:"e.g. 55"},
          {key:"milestonesHit",label:"Milestones Hit",placeholder:"e.g. First mock above cutoff"},
          {key:"reflection",label:"Month Reflection",type:"textarea",placeholder:"Honest assessment..."},
        ]}
      />
    </div>
  );
}

function DigitalTab(){
  const{data,set}=useEC();
  return(
    <div>
      <SectionTitle icon="💻" title="Digital & Content" sub="Tools + rules + YouTube/FB content plan + voice notes + ideas."/>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🛠️ DIGITAL TOOLS</div>
        <ObjList path="digitalTools" fields={[{key:"tool",label:"Tool"},{key:"purpose",label:"Purpose"},{key:"color",label:"Color (hex)"}]} blank={{tool:"New Tool",purpose:"...",color:C.blue}} addLabel="Add Tool"
          renderRow={(t,i)=><div style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{width:8,height:8,borderRadius:"50%",background:t.color||C.muted}}/><div style={{color:t.color||C.muted,fontWeight:700,fontSize:13,minWidth:70}}>{t.tool}</div><div style={{color:C.muted,fontSize:12}}>{t.purpose}</div></div>}
        />
      </Card>
      <Card glow={C.red}>
        <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:10}}>🚫 DIGITAL RULES</div>
        <StrList path="digitalRules" addLabel="Add Rule"/>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🎥 YOUTUBE 7-DAY SYSTEM</div>
        {(data.youtubeWeek||[]).map((d,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
            <span style={{color:C.muted,fontSize:12,minWidth:70}}>{d.day}</span>
            <div style={{flex:1,height:28,background:d.color+"22",border:`1px solid ${d.color}44`,borderRadius:6,display:"flex",alignItems:"center",paddingLeft:10}}><span style={{color:d.color,fontSize:12,fontWeight:700}}>{d.task}</span></div>
          </div>
        ))}
      </Card>
      {/* Content Schedule */}
      <Card glow={C.gold} style={{background:"rgba(244,167,38,0.05)"}}>
        <div style={{color:C.gold,fontWeight:700,fontSize:12,marginBottom:6}}>⚠️ GOLDEN RULE — Content</div>
        <div style={{color:C.text,fontSize:13,lineHeight:1.6}}>YouTube + FB sirf tadi karo jad us din de SAB exam tasks mukk chuke hon. Exam first, always.</div>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📅 WEEKLY CONTENT SCHEDULE</div>
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 1fr",gap:6,marginBottom:8,padding:"0 4px"}}>
          <div style={{color:C.muted,fontSize:10,fontWeight:700}}>Day</div>
          <div style={{color:C.gold,fontSize:10,fontWeight:700}}>🎥 YT Hrs</div>
          <div style={{color:C.gold,fontSize:10,fontWeight:700}}>🎥 YT Topic</div>
          <div style={{color:C.blue,fontSize:10,fontWeight:700}}>📘 FB Hrs</div>
          <div style={{color:C.blue,fontSize:10,fontWeight:700}}>📘 FB Topic</div>
        </div>
        {(data.contentSchedule||[]).map((row,i)=>{
          const dc=["#8B5CF6","#3B82F6","#10B981","#F4A726","#EC4899","#FF6B35","#14B8A6"][i%7];
          return(
            <div key={i} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 1fr",gap:6,marginBottom:6,alignItems:"center"}}>
              <div style={{background:dc+"22",border:`1px solid ${dc}44`,borderRadius:8,padding:"6px 4px",textAlign:"center",color:dc,fontWeight:800,fontSize:11}}>{row.day.slice(0,3)}</div>
              <input style={{...IS,fontSize:11}} placeholder="hrs" value={row.ytHours||""} onChange={e=>set("contentSchedule",(data.contentSchedule||[]).map((r,j)=>j===i?{...r,ytHours:e.target.value}:r))}/>
              <input style={{...IS,fontSize:11}} placeholder="topic" value={row.ytTopic||""} onChange={e=>set("contentSchedule",(data.contentSchedule||[]).map((r,j)=>j===i?{...r,ytTopic:e.target.value}:r))}/>
              <input style={{...IS,fontSize:11}} placeholder="hrs" value={row.fbHours||""} onChange={e=>set("contentSchedule",(data.contentSchedule||[]).map((r,j)=>j===i?{...r,fbHours:e.target.value}:r))}/>
              <input style={{...IS,fontSize:11}} placeholder="topic" value={row.fbTopic||""} onChange={e=>set("contentSchedule",(data.contentSchedule||[]).map((r,j)=>j===i?{...r,fbTopic:e.target.value}:r))}/>
            </div>
          );
        })}
        <div style={{display:"flex",gap:10,marginTop:8}}>
          {[{label:"YT Total",key:"ytHours",color:C.gold},{label:"FB Total",key:"fbHours",color:C.blue}].map(f=>(
            <div key={f.key} style={{flex:1,background:f.color+"11",borderRadius:8,padding:8,textAlign:"center"}}>
              <div style={{color:f.color,fontSize:10,fontWeight:700}}>{f.label}</div>
              <div style={{color:C.text,fontWeight:900,fontSize:16}}>{(data.contentSchedule||[]).reduce((s,r)=>s+(parseFloat(r[f.key])||0),0).toFixed(1)}h</div>
            </div>
          ))}
        </div>
      </Card>
      {/* Voice Notes */}
      <Card glow={C.purple}>
        <div style={{fontSize:12,color:C.purple,fontWeight:700,marginBottom:10}}>🎙️ VOICE NOTES & IDEAS</div>
        <VoiceAndIdeas/>
      </Card>
      <MonthlyRecord
        storagePrefix="digital-monthly"
        title="Digital & Content Monthly"
        color={C.teal}
        fields={[
          {key:"ytVideos",label:"YouTube Videos Published",type:"number",placeholder:"e.g. 4"},
          {key:"fbPosts",label:"FB Posts",type:"number",placeholder:"e.g. 12"},
          {key:"subscribers",label:"YT Subscribers",type:"number",placeholder:"e.g. 250"},
          {key:"digitalHealth",label:"Digital Health Note",type:"textarea",placeholder:"Screen time, distractions this month?"},
          {key:"nextPlan",label:"Next Month Content Plan",type:"textarea",placeholder:"Topics, upload schedule..."},
        ]}
      />
    </div>
  );
}

function VoiceAndIdeas(){
  const{data,set}=useEC();
  const[text,setText]=useState("");
  const[type,setType]=useState("💡 Idea");
  const all=data.voiceNotes||[];

  const add=()=>{
    if(!text.trim())return;
    const entry={id:Date.now(),type,text,date:todayStr(),done:false};
    set("voiceNotes",[...all,entry]);
    setText("");
  };

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["💡 Idea","🎙️ Voice Note","📌 Capture"].map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{flex:1,padding:"6px 4px",borderRadius:7,border:"none",background:type===t?C.purple:"rgba(255,255,255,0.06)",color:type===t?"#fff":C.muted,fontWeight:700,cursor:"pointer",fontSize:10}}>{t}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} style={{...IS,flex:1}} placeholder={`New ${type}...`}/>
        <button onClick={add} style={{background:C.purple,color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer"}}>+</button>
      </div>
      <div style={{maxHeight:250,overflowY:"auto"}}>
        {all.slice().reverse().map((item,i)=>(
          <div key={item.id} style={{background:item.done?C.green+"08":C.card,border:`1px solid ${item.done?C.green+"33":C.border}`,borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div onClick={()=>set("voiceNotes",all.map(x=>x.id===item.id?{...x,done:!x.done}:x))} style={{width:18,height:18,borderRadius:4,border:`2px solid ${item.done?C.green:"rgba(255,255,255,0.2)"}`,background:item.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                {item.done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{color:C.purple,fontSize:10,marginBottom:2}}>{item.type} • {item.date}</div>
                <div style={{color:item.done?C.green:C.text,fontSize:12,textDecoration:item.done?"line-through":"none"}}>{item.text}</div>
              </div>
              <button onClick={()=>set("voiceNotes",all.filter(x=>x.id!==item.id))} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:4,padding:"3px 6px",fontSize:10,cursor:"pointer"}}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistTab(){
  const{data,set}=useEC();
  const[checked,setChecked]=useState({});
  const[history,setHistory]=useState([]);
  const[todayPct,setTodayPct]=useState("");

  const toggle=k=>setChecked(p=>({...p,[k]:!p[k]}));
  const score=Object.keys(checked).filter(k=>checked[k]).length;
  const maxScore=(data.checklistItems||[]).length+(data.topperEdge||[]).length;
  // 100% means 100 — use actual percentage
  const pct=maxScore>0?Math.round((score/maxScore)*100):0;

  useEffect(()=>{stGet("streak-history").then(v=>{if(v)setHistory(v);});},[]);
  const logStreak=async()=>{
    const p=Number(todayPct);if(isNaN(p)||todayPct==="")return;
    const entry={date:new Date().toDateString(),pct:p};
    const updated=history.filter(h=>h.date!==entry.date).concat([entry]);
    setHistory(updated);setTodayPct("");await stSet("streak-history",updated);
  };
  let streak=0;
  const sorted=history.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  for(const h of sorted){if(h.pct>=70)streak++;else break;}

  return(
    <div>
      <SectionTitle icon="✅" title="Daily Checklist" sub="Raat nu har item tick karna hai. Zero fake ticks."/>

      {/* Streak */}
      <Card glow={C.saffron}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:4}}>🔥 CONSISTENCY STREAK</div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontSize:40,fontWeight:900,color:streak>0?C.saffron:C.muted}}>{streak}</div>
          <div style={{color:C.muted,fontSize:12}}>day streak (70%+ days)</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <input type="number" placeholder="Today's %" value={todayPct} onChange={e=>setTodayPct(e.target.value)} style={{...IS,flex:1}}/>
          <button onClick={logStreak} style={{background:C.saffron,color:"#fff",border:"none",borderRadius:6,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Log</button>
        </div>
        {sorted.length>0&&<div style={{display:"flex",gap:3,marginTop:10,flexWrap:"wrap"}}>{sorted.slice(0,21).reverse().map((h,i)=><div key={i} title={`${h.date}: ${h.pct}%`} style={{width:16,height:16,borderRadius:3,background:h.pct>=70?C.green:h.pct>=40?C.gold:C.red}}/>)}</div>}
      </Card>

      {/* Score — Fixed 100% means 100 */}
      <div style={{background:"linear-gradient(135deg,rgba(255,107,53,0.12),rgba(244,167,38,0.06))",borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div><div style={{color:C.muted,fontSize:12}}>Today's Score</div><div style={{color:C.text,fontWeight:800,fontSize:28}}>{score}<span style={{color:C.muted,fontSize:14}}>/{maxScore}</span> <span style={{color:pct>=80?C.green:C.gold,fontSize:16}}>({pct}%)</span></div></div>
          <div style={{fontSize:36}}>{score===maxScore?"🏆":pct>=70?"🔥":pct>=40?"💪":"🚀"}</div>
        </div>
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:pct>=80?C.green:pct>=50?C.gold:C.red,transition:"width 0.3s"}}/>
        </div>
      </div>

      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📋 DAILY ITEMS</div>
        <StrList path="checklistItems" addLabel="Add Checklist Item" renderItem={(item,i)=>(
          <div onClick={()=>toggle("c"+i)} style={{display:"flex",gap:10,alignItems:"center",cursor:"pointer",padding:"4px 0"}}>
            <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked["c"+i]?C.green:"rgba(255,255,255,0.2)"}`,background:checked["c"+i]?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {checked["c"+i]&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
            </div>
            <span style={{color:checked["c"+i]?C.green:C.text,fontSize:13,textDecoration:checked["c"+i]?"line-through":"none",flex:1}}>{item}</span>
          </div>
        )}/>
      </Card>

      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🥇 TOPPER'S EDGE</div>
        <ObjList path="topperEdge" fields={[{key:"item",label:"Item"},{key:"why",label:"Why It Matters"}]} blank={{item:"New Edge Item",why:"..."}} addLabel="Add Edge Item"
          renderRow={(t,i)=>(
            <div onClick={()=>toggle("e"+i)} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${checked["e"+i]?C.gold:"rgba(255,255,255,0.2)"}`,background:checked["e"+i]?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                {checked["e"+i]&&<span style={{color:"#000",fontSize:11}}>✓</span>}
              </div>
              <div><div style={{color:checked["e"+i]?C.gold:C.text,fontSize:13,fontWeight:600,textDecoration:checked["e"+i]?"line-through":"none"}}>{t.item}</div><div style={{color:C.muted,fontSize:11,marginTop:1}}>{t.why}</div></div>
            </div>
          )}
        />
      </Card>

      <Card style={{background:"rgba(239,68,68,0.06)",border:`1px solid ${C.red}33`}}>
        <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:10}}>🚨 EMERGENCY MINIMUM DAY</div>
        {["20 MCQs (any subject)","10 Min Anki review","Meditation (5 min)","Sleep on time"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"4px 0",color:C.text,fontSize:13}}><span style={{color:C.green}}>✅</span><span>{item}</span></div>
        ))}
        <div style={{marginTop:10,color:C.red,fontWeight:700,fontSize:13,textAlign:"center"}}>Never Let A Bad Day Become A Bad Week! 💪</div>
      </Card>
    </div>
  );
}

function MasterMatrixTab(){
  const{data,set}=useEC();
  const updateHrs=(si,ti,val)=>{
    const updated=(data.studyMatrix||[]).map((s,i)=>i!==si?s:{...s,subTopics:s.subTopics.map((t,j)=>j!==ti?t:{...t,actualHrs:Math.max(0,Number(val))})});
    set("studyMatrix",updated);
  };
  const updateTarget=(si,ti,val)=>{
    const updated=(data.studyMatrix||[]).map((s,i)=>i!==si?s:{...s,subTopics:s.subTopics.map((t,j)=>j!==ti?t:{...t,targetHrs:Math.max(0,Number(val))})});
    set("studyMatrix",updated);
  };
  const addSubject=()=>{
    set("studyMatrix",[...(data.studyMatrix||[]),{id:"subj"+Date.now(),subject:"📗 New Subject",subTopics:[{name:"Topic 1",targetHrs:5,actualHrs:0,notes:""}]}]);
  };
  const addTopic=(si)=>{
    const updated=(data.studyMatrix||[]).map((s,i)=>i!==si?s:{...s,subTopics:[...s.subTopics,{name:"New Topic",targetHrs:3,actualHrs:0,notes:""}]});
    set("studyMatrix",updated);
  };
  const{em}=useEC();
  return(
    <div>
      <SectionTitle icon="🧠" title="Master Matrix" sub="Granular hour-tracking per subject and topic."/>
      {(data.studyMatrix||[]).map((subj,sIdx)=>{
        const totalTarget=subj.subTopics.reduce((acc,t)=>acc+Number(t.targetHrs),0);
        const totalActual=subj.subTopics.reduce((acc,t)=>acc+Number(t.actualHrs),0);
        // FIX: 100% means 100
        const pct=totalTarget>0?Math.min(100,Math.round((totalActual/totalTarget)*100)):0;
        return(
          <Card key={subj.id||sIdx} glow={pct===100?C.green:C.saffron}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderBottom:`1px solid ${C.border}`,paddingBottom:14,marginBottom:14}}>
              <div style={{flex:1}}>
                {em?<input value={subj.subject} onChange={e=>set("studyMatrix",(data.studyMatrix||[]).map((s,i)=>i!==sIdx?s:{...s,subject:e.target.value}))} style={{...IS,fontWeight:800,fontSize:16,marginBottom:8}}/>
                :<h3 style={{margin:"0 0 8px 0",color:C.text,fontSize:18}}>{subj.subject}</h3>}
                <div style={{height:6,width:140,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:pct+"%",background:pct===100?C.green:`linear-gradient(90deg,${C.saffron},${C.gold})`}}/>
                </div>
                <div style={{color:C.muted,fontSize:11,marginTop:4}}>{pct}% complete ({totalActual}/{totalTarget}h)</div>
              </div>
              <div style={{textAlign:"right",color:pct===100?C.green:C.gold,fontSize:22,fontWeight:900}}>{totalActual}<span style={{fontSize:13,color:C.muted,fontWeight:400}}>/{totalTarget}h</span></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {subj.subTopics.map((topic,tIdx)=>(
                <div key={tIdx} style={{display:"flex",alignItems:"center",background:"rgba(0,0,0,0.2)",padding:12,borderRadius:10,border:`1px solid ${C.border}`,gap:10}}>
                  <div style={{flex:2}}>
                    {em?<input value={topic.name} onChange={e=>set("studyMatrix",(data.studyMatrix||[]).map((s,i)=>i!==sIdx?s:{...s,subTopics:s.subTopics.map((t,j)=>j!==tIdx?t:{...t,name:e.target.value})}))} style={{...IS,fontWeight:700,fontSize:13,marginBottom:4}}/>
                    :<div style={{color:C.text,fontWeight:700,fontSize:14}}>{topic.name}</div>}
                    {em?<input value={topic.notes} onChange={e=>set("studyMatrix",(data.studyMatrix||[]).map((s,i)=>i!==sIdx?s:{...s,subTopics:s.subTopics.map((t,j)=>j!==tIdx?t:{...t,notes:e.target.value})}))} style={{...IS,fontSize:11}} placeholder="Notes..."/>
                    :<div style={{color:C.muted,fontSize:12,marginTop:3}}>{topic.notes}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <span style={{fontSize:9,color:C.muted,marginBottom:2}}>Done</span>
                      <input type="number" value={topic.actualHrs} onChange={e=>updateHrs(sIdx,tIdx,e.target.value)} style={{width:45,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.gold}44`,color:C.gold,borderRadius:6,padding:6,textAlign:"center",fontWeight:800,outline:"none"}}/>
                    </div>
                    <span style={{color:C.muted}}>/</span>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <span style={{fontSize:9,color:C.muted,marginBottom:2}}>Goal</span>
                      <input type="number" value={topic.targetHrs} onChange={e=>updateTarget(sIdx,tIdx,e.target.value)} style={{width:45,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:6,padding:6,textAlign:"center",fontWeight:800,outline:"none"}}/>
                    </div>
                    {em&&<button onClick={()=>set("studyMatrix",(data.studyMatrix||[]).map((s,i)=>i!==sIdx?s:{...s,subTopics:s.subTopics.filter((_,j)=>j!==tIdx)}))} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:5,padding:"4px 7px",fontSize:10,cursor:"pointer"}}>✕</button>}
                  </div>
                </div>
              ))}
              {em&&<button onClick={()=>addTopic(sIdx)} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:8,padding:7,fontSize:11,cursor:"pointer",fontWeight:700}}>+ Add Topic</button>}
            </div>
          </Card>
        );
      })}
      {em&&<button onClick={addSubject} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:8,padding:"10px 18px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginBottom:16}}>+ Add New Subject</button>}
      <MonthlyRecord
        storagePrefix="matrix-monthly"
        title="Matrix Monthly Snapshot"
        color={C.purple}
        fields={[
          {key:"agriHrs",label:"Agriculture Hours",type:"number",placeholder:"e.g. 25"},
          {key:"quantHrs",label:"Quant Hours",type:"number",placeholder:"e.g. 18"},
          {key:"reasoningHrs",label:"Reasoning Hours",type:"number",placeholder:"e.g. 12"},
          {key:"gkHrs",label:"Punjab GK Hours",type:"number",placeholder:"e.g. 10"},
          {key:"totalHrs",label:"Total Matrix Hours",type:"number",placeholder:"e.g. 65"},
          {key:"note",label:"Matrix Note",type:"textarea",placeholder:"Which subjects are on track?"},
        ]}
      />
    </div>
  );
}

function CommunityTab(){
  const{data,set}=useEC();
  const c=data.community||{circuit:[],sarpanchScript:"",youtubePipeline:[]};
  return(
    <div>
      <SectionTitle icon="🌍" title="Community & Outreach" sub="CM Yogshala circuit + YouTube pipeline + sarpanch script."/>
      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>🗺️ CM YOGSHALA CIRCUIT</div>
        <StrList path="community.circuit" addLabel="Add Village/Location"/>
      </Card>
      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:8}}>📜 SARPANCH OUTREACH SCRIPT</div>
        <ET value={c.sarpanchScript} onChange={v=>set("community",{...c,sarpanchScript:v})} multiline placeholder="Write your sarpanch outreach message..." style={{color:C.text,fontSize:13,lineHeight:1.7,whiteSpace:"pre-line"}}/>
      </Card>
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:10}}>🎥 YOUTUBE CONTENT PIPELINE</div>
        <ObjList path="community.youtubePipeline" fields={[{key:"day",label:"Day"},{key:"stage",label:"Stage"},{key:"task",label:"Task",multiline:true}]} blank={{day:"Day",stage:"Stage",task:"..."}} addLabel="Add Pipeline Step"
          renderRow={(p,i)=><div style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}><div style={{color:C.gold,fontWeight:700,fontSize:12}}>{p.day} — {p.stage}</div><div style={{color:C.text,fontSize:12,marginTop:2}}>{p.task}</div></div>}
        />
      </Card>
      <MonthlyRecord
        storagePrefix="community-monthly"
        title="Community Monthly"
        color={C.green}
        fields={[
          {key:"classesHeld",label:"Yoga Classes Held",type:"number",placeholder:"e.g. 22"},
          {key:"studentsReached",label:"Students Reached",type:"number",placeholder:"e.g. 150"},
          {key:"newLocations",label:"New Locations Added",placeholder:"e.g. Gander village"},
          {key:"communityNote",label:"Community Note",type:"textarea",placeholder:"Highlights, challenges..."},
        ]}
      />
    </div>
  );
}

// ─── SCORECARD TAB ───────────────────────────────────────────────────────────
function todayKey(){const d=new Date();return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}

function ScorecardTab(){
  const{data,set}=useEC();
  const[scores,setScores]=useState({});
  const[history,setHistory]=useState([]);
  const[view,setView]=useState("today");
  const load=async()=>{
    const td=await stGet("scorecard:"+todayKey());
    if(td)setScores(td.scores||td);
    const keys=await stList("scorecard:");
    const loaded=[];
    for(const k of keys){const v=await stGet(k);if(v)loaded.push({key:k,...v});}
    loaded.sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));
    setHistory(loaded);
  };
  useEffect(()=>{load();},[]);
  const tasks=data.summer60||[];
  const total=tasks.reduce((s,t)=>s+(scores[t.id]||0),0);
  const maxTotal=tasks.reduce((s,t)=>s+Number(t.max),0);
  const pct=maxTotal>0?Math.round(total/maxTotal*100):0;
  const saveToday=async()=>{
    const payload={scores,total,maxTotal,pct,date:new Date().toDateString(),savedAt:Date.now()};
    await stSet("scorecard:"+todayKey(),payload);
    let sh=(await stGet("streak-history"))||[];
    sh=sh.filter(h=>h.date!==new Date().toDateString()).concat([{date:new Date().toDateString(),pct}]);
    await stSet("streak-history",sh);
    await load();
  };
  const avg7=(()=>{const l=history.slice(-7);return l.length?Math.round(l.reduce((s,h)=>s+(h.pct||0),0)/l.length):null;})();
  return(
    <div>
      <SectionTitle icon="🏆" title="Summer 60 Challenge — Scorecard" sub="100% Execution | Top 1% Mindset"/>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["today","📝 Today",C.saffron],["history",`📊 History (${history.length})`,C.blue],["edit","✏️ Edit Tasks",C.gold]].map(([id,label,col])=>(
          <button key={id} onClick={()=>setView(id)} style={{flex:1,padding:9,borderRadius:8,border:"none",background:view===id?col:"rgba(255,255,255,0.06)",color:view===id?(id==="edit"?"#000":"#fff"):C.muted,fontWeight:700,cursor:"pointer",fontSize:11}}>{label}</button>
        ))}
      </div>
      {view==="today"&&(
        <div>
          <Card style={{background:`linear-gradient(135deg,rgba(255,107,53,0.12),rgba(244,167,38,0.06))`,border:`1px solid ${C.saffron}44`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{color:C.muted,fontSize:11}}>Today's Total</div><div style={{color:C.text,fontSize:28,fontWeight:900}}>{total}<span style={{color:C.muted,fontSize:16}}>/{maxTotal}</span></div><div style={{color:pct>=70?C.green:pct>=40?C.gold:C.red,fontWeight:700,fontSize:13}}>{pct}%</div></div>
              <button onClick={saveToday} style={{background:C.green,color:"#fff",border:"none",borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:800,cursor:"pointer"}}>💾 Save Today</button>
            </div>
          </Card>
          {tasks.map(t=>{
            const val=scores[t.id]||0;
            return(
              <Card key={t.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{flex:1}}><div style={{color:C.text,fontWeight:700,fontSize:13}}>{t.icon} {t.phase}</div><div style={{color:C.gold,fontSize:11,marginTop:2}}>⏰ {t.time}</div></div>
                  <div style={{color:C.saffron,fontWeight:800,fontSize:13}}>⭐ Max {t.max}</div>
                </div>
                <div style={{color:C.muted,fontSize:12,marginBottom:8}}>🎯 {t.how}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="range" min="0" max={t.max} value={val} onChange={e=>setScores({...scores,[t.id]:Number(e.target.value)})} style={{flex:1,accentColor:C.gold}}/>
                  <input type="number" min="0" max={t.max} value={val} onChange={e=>{let n=Math.min(Number(e.target.value),Number(t.max));setScores({...scores,[t.id]:n});}} style={{...IS,width:50,textAlign:"center"}}/>
                </div>
              </Card>
            );
          })}
          <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>📊 HONEST SCORING CRITERIA</div>
        {(data.summer60ScoringRules||[]).map((r,i)=>(
          <div key={i} style={{padding:"7px 0",borderBottom:i<((data.summer60ScoringRules||[]).length-1)?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.gold,fontWeight:700,fontSize:12}}>{r.score}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>{r.rule}</div>
          </div>
        ))}
      </Card>
      <Card glow={C.blue}><div style={{color:C.blue,fontWeight:700,fontSize:12}}>🚀 Top 1% Rule</div><div style={{color:C.text,fontSize:12,marginTop:4}}>Har Sunday apna 7-day average track karo. Results make the noise — keep it quiet, keep it clean.</div>{avg7!==null&&<div style={{marginTop:8,color:C.gold,fontWeight:700,fontSize:13}}>7-day avg: {avg7}%</div>}</Card>
        </div>
      )}
      {view==="history"&&(
        <div>
          {history.length===0&&<Card><div style={{color:C.muted}}>No days saved yet.</div></Card>}
          {history.slice().reverse().map((h,i)=>(
            <Card key={i}><div style={{display:"flex",justifyContent:"space-between"}}><div style={{color:C.text,fontWeight:700}}>{h.date}</div><div style={{color:h.pct>=70?C.green:h.pct>=40?C.gold:C.red,fontWeight:800,fontSize:16}}>{h.total}/{h.maxTotal} ({h.pct}%)</div></div></Card>
          ))}
          {history.length>0&&<Card glow={C.green}><div style={{color:C.green,fontWeight:700}}>All-Time Avg</div><div style={{color:C.text,fontSize:22,fontWeight:800,marginTop:4}}>{Math.round(history.reduce((s,h)=>s+(h.pct||0),0)/history.length)}%</div></Card>}
        </div>
      )}
      {view==="edit"&&(
        <Card>
          <div style={{color:C.gold,fontSize:12,fontWeight:700,marginBottom:10}}>✏️ Edit Scorecard Tasks</div>
          <ObjList path="summer60" fields={[{key:"icon",label:"Icon"},{key:"phase",label:"Phase Name"},{key:"time",label:"Time/Target"},{key:"how",label:"How To Do"},{key:"max",label:"Max Points"}]} blank={{id:"t"+Date.now(),icon:"⭐",phase:"New Task",time:"Anytime",how:"Do this",max:10}} addLabel="Add Task"
            renderRow={t=><div style={{padding:"6px 0",color:C.text,fontSize:12}}>{t.icon} {t.phase} — max {t.max}</div>}
          />
        </Card>
      )}
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
// ─── ANALYTICS TAB (auto-connected to Scorecard, MCQ Tracker, Pomodoro, Checklist, Mock Scores, PYQ/Progress) ──
function AnalyticsTab(){
  const{data,set}=useEC();
  const SUBJECTS=["Agriculture","Quant","Reasoning","English","Computer","Punjab GK","Current Affairs"];
  const YEARS=["2024","2023","2022","2021","2020","2019","2018","2017"];

  const[loaded,setLoaded]=useState(false);
  const[scorecardHist,setScorecardHist]=useState([]); // {date,pct} — shared by Scorecard + Checklist
  const[mcqEntries,setMcqEntries]=useState([]);
  const[pomodoroHist,setPomodoroHist]=useState([]);
  const[mockScores,setMockScores]=useState([]); // {date,score}
  const[pyqData,setPyqData]=useState({});

  const loadAll=async()=>{
    const sh=(await stGet("streak-history"))||[];
    const mcq=(await stGet("mcq-tracker-entries"))||[];
    const pom=(await stGet("pomodoro-history"))||[];
    const pyq=(await stGet("pyq-tracker-data"))||{};
    const mkeys=await stList("mock:");
    const mocks=[];for(const k of mkeys){const v=await stGet(k);if(v)mocks.push(v);}
    mocks.sort((a,b)=>a.date>b.date?1:-1);
    setScorecardHist(sh);setMcqEntries(mcq);setPomodoroHist(pom);setMockScores(mocks);setPyqData(pyq);
    setLoaded(true);
  };
  useEffect(()=>{loadAll();},[]);

  const goals=data.analyticsGoals||{dailyMcqTarget:80,weeklyFocusHrsTarget:20,targetAccuracy:75};
  const setGoal=(k,v)=>set("analyticsGoals",{...goals,[k]:v});

  // ── Weekly (last 7 days) ──────────────────────────────────────────────────
  const last7Dates=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d;});
  const fmtDay=d=>d.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit"});
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const scByDate={};scorecardHist.forEach(h=>{scByDate[new Date(h.date).toDateString()]=h.pct;});
  const weeklyScore=last7Dates.map(d=>({label:fmtDay(d),value:scByDate[d.toDateString()]??0}));
  const mcqByDate={};mcqEntries.forEach(e=>{if(!mcqByDate[e.date])mcqByDate[e.date]=[];mcqByDate[e.date].push(e.accuracy);});
  const weeklyMcqAcc=last7Dates.map(d=>{const arr=mcqByDate[dateKey(d)]||[];return{label:fmtDay(d),value:arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0};});
  const pomByDate={};pomodoroHist.forEach(p=>{pomByDate[p.date]=(pomByDate[p.date]||0)+(p.workSecs||0);});
  const weeklyFocusMin=last7Dates.map(d=>({label:fmtDay(d),value:Math.round((pomByDate[dateKey(d)]||0)/60)}));

  // ── Monthly (last 6 months) ───────────────────────────────────────────────
  const last6Months=[...Array(6)].map((_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return d;});
  const mLabel=d=>d.toLocaleDateString("en-IN",{month:"short"});
  const mKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const scByMonth={};scorecardHist.forEach(h=>{const dt=new Date(h.date);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;if(!scByMonth[k])scByMonth[k]=[];scByMonth[k].push(h.pct);});
  const monthlyScore=last6Months.map(d=>{const arr=scByMonth[mKey(d)]||[];return{label:mLabel(d),value:arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0};});
  const mcqByMonth={};mcqEntries.forEach(e=>{const k=e.date.slice(0,7);if(!mcqByMonth[k])mcqByMonth[k]=0;mcqByMonth[k]+=e.attempted;});
  const monthlyMcqVolume=last6Months.map(d=>({label:mLabel(d),value:mcqByMonth[mKey(d)]||0}));
  const focusByMonth={};pomodoroHist.forEach(p=>{const k=p.date.slice(0,7);focusByMonth[k]=(focusByMonth[k]||0)+(p.workSecs||0);});
  const monthlyFocusHrs=last6Months.map(d=>({label:mLabel(d),value:Math.round(((focusByMonth[mKey(d)]||0)/3600)*10)/10}));

  // ── Accuracy trend (MCQ sessions, chronological) ──────────────────────────
  const mcqChrono=mcqEntries.slice().sort((a,b)=>a.date>b.date?1:-1);
  const accuracyTrendData=mcqChrono.slice(-12).map(e=>({label:e.date.slice(5),value:e.accuracy}));
  const firstHalf=mcqChrono.slice(0,Math.floor(mcqChrono.length/2));
  const secondHalf=mcqChrono.slice(Math.floor(mcqChrono.length/2));
  const avgOf=arr=>arr.length?Math.round(arr.reduce((a,e)=>a+e.accuracy,0)/arr.length):0;
  const accTrendDelta=mcqChrono.length>=4?avgOf(secondHalf)-avgOf(firstHalf):null;

  // ── Productivity trend (Pomodoro, last 14 days) ───────────────────────────
  const last14=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d;});
  const productivityTrendData=last14.map(d=>({label:fmtDay(d),value:Math.round((pomByDate[dateKey(d)]||0)/60)}));
  const firstWeekMin=productivityTrendData.slice(0,7).reduce((a,d)=>a+d.value,0);
  const secondWeekMin=productivityTrendData.slice(7).reduce((a,d)=>a+d.value,0);
  const prodTrendDelta=secondWeekMin-firstWeekMin;

  // ── Subject comparison (MCQ accuracy vs PYQ coverage) ─────────────────────
  const subjectCompare=SUBJECTS.map(s=>{
    const es=mcqEntries.filter(e=>e.subject===s);
    const mcqAcc=es.length?Math.round(es.reduce((a,e)=>a+e.accuracy,0)/es.length):0;
    const pyqDone=YEARS.filter(y=>pyqData[s+"-"+y]).length;
    const pyqPct=Math.round((pyqDone/YEARS.length)*100);
    return{subject:s,mcqAcc,pyqPct,sessions:es.length};
  });

  // ── Overall performance dashboard ─────────────────────────────────────────
  const totalMcqAttempted=mcqEntries.reduce((a,e)=>a+e.attempted,0);
  const overallMcqAcc=mcqEntries.length?Math.round(mcqEntries.reduce((a,e)=>a+e.accuracy,0)/mcqEntries.length):0;
  const sortedSh=scorecardHist.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const last7Sc=sortedSh.slice(0,7);
  const avgScorecard7=last7Sc.length?Math.round(last7Sc.reduce((a,h)=>a+h.pct,0)/last7Sc.length):0;
  let streak=0;for(const h of sortedSh){if(h.pct>=70)streak++;else break;}
  const totalFocusHrsAllTime=Math.round((pomodoroHist.reduce((a,p)=>a+(p.workSecs||0),0)/3600)*10)/10;
  const overallPyqPct=Math.round((Object.values(pyqData).filter(Boolean).length/(SUBJECTS.length*YEARS.length))*100)||0;
  const mockTrend=mockScores.length>=2?mockScores[mockScores.length-1].score-mockScores[mockScores.length-2].score:0;
  const today=new Date();today.setHours(0,0,0,0);
  const exam=data.examDate?new Date(data.examDate):null;
  const daysLeft=exam?Math.ceil((exam-today)/86400000):null;
  const readinessPct=Math.min(100,Math.round(avgScorecard7*0.35+overallMcqAcc*0.35+overallPyqPct*0.15+Math.min(100,totalFocusHrsAllTime*2)*0.15));

  if(!loaded)return <div><SectionTitle icon="📊" title="Performance Analytics" sub="Loading connected data..."/></div>;

  const noDataAnywhere=!scorecardHist.length&&!mcqEntries.length&&!pomodoroHist.length&&!mockScores.length&&!Object.keys(pyqData).length;

  return(
    <div>
      <SectionTitle icon="📊" title="Performance Analytics" sub="Auto-connected to Scorecard, MCQ Tracker, Pomodoro, Checklist, Mock Scores & PYQ Tracker."/>

      {noDataAnywhere&&(
        <Card><div style={{color:C.muted,fontSize:12,textAlign:"center"}}>No data logged yet anywhere. Start using Scorecard, MCQ Tracker, Pomodoro, or Mock Scores — this dashboard fills in automatically.</div></Card>
      )}

      {/* OVERALL PERFORMANCE DASHBOARD */}
      <Card glow={readinessPct>=70?C.green:readinessPct>=40?C.gold:C.red} style={{textAlign:"center",padding:28}}>
        <div style={{color:C.muted,fontSize:12,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Overall Readiness Score</div>
        <div style={{fontSize:64,fontWeight:900,color:readinessPct>=70?C.green:readinessPct>=40?C.gold:C.red,textShadow:`0 0 30px ${readinessPct>=70?C.green:C.gold}40`}}>{readinessPct}%</div>
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",maxWidth:300,margin:"14px auto 0"}}>
          <div style={{width:readinessPct+"%",height:"100%",background:`linear-gradient(90deg,${C.gold},${C.green})`,transition:"width 1s"}}/>
        </div>
        <p style={{color:C.muted,fontSize:12,marginTop:10}}>Blended from 7-day scorecard avg, MCQ accuracy, PYQ coverage & focus hours.</p>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <Card style={{margin:0,textAlign:"center"}} glow={C.blue}>
          <div style={{color:C.muted,fontSize:10}}>SCORECARD (7d avg)</div>
          <div style={{fontSize:26,fontWeight:900,color:C.blue}}>{avgScorecard7}%</div>
        </Card>
        <Card style={{margin:0,textAlign:"center"}} glow={C.teal}>
          <div style={{color:C.muted,fontSize:10}}>MCQ ACCURACY</div>
          <div style={{fontSize:26,fontWeight:900,color:C.teal}}>{overallMcqAcc}%</div>
          <div style={{color:C.muted,fontSize:9}}>{totalMcqAttempted} solved</div>
        </Card>
        <Card style={{margin:0,textAlign:"center"}} glow={C.saffron}>
          <div style={{color:C.muted,fontSize:10}}>STREAK</div>
          <div style={{fontSize:26,fontWeight:900,color:C.saffron}}>🔥{streak}</div>
        </Card>
        <Card style={{margin:0,textAlign:"center"}} glow={C.purple}>
          <div style={{color:C.muted,fontSize:10}}>PYQ COVERAGE</div>
          <div style={{fontSize:26,fontWeight:900,color:C.purple}}>{overallPyqPct}%</div>
        </Card>
        <Card style={{margin:0,textAlign:"center"}} glow={C.green}>
          <div style={{color:C.muted,fontSize:10}}>FOCUS (all-time)</div>
          <div style={{fontSize:26,fontWeight:900,color:C.green}}>{totalFocusHrsAllTime}h</div>
        </Card>
        <Card style={{margin:0,textAlign:"center"}} glow={daysLeft!==null&&daysLeft<=30?C.red:C.gold}>
          <div style={{color:C.muted,fontSize:10}}>EXAM IN</div>
          <div style={{fontSize:26,fontWeight:900,color:daysLeft!==null&&daysLeft<=30?C.red:C.gold}}>{daysLeft??"—"}</div>
        </Card>
      </div>

      {/* EDITABLE GOALS */}
      <Card glow={C.gold}>
        <div style={{color:C.gold,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>🎯 EDITABLE TARGETS</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div><div style={{color:C.muted,fontSize:10,marginBottom:3}}>Daily MCQs</div><input type="number" style={IS} value={goals.dailyMcqTarget} onChange={e=>setGoal("dailyMcqTarget",Number(e.target.value))}/></div>
          <div><div style={{color:C.muted,fontSize:10,marginBottom:3}}>Weekly Focus (hrs)</div><input type="number" style={IS} value={goals.weeklyFocusHrsTarget} onChange={e=>setGoal("weeklyFocusHrsTarget",Number(e.target.value))}/></div>
          <div><div style={{color:C.muted,fontSize:10,marginBottom:3}}>Target Accuracy %</div><input type="number" style={IS} value={goals.targetAccuracy} onChange={e=>setGoal("targetAccuracy",Number(e.target.value))}/></div>
        </div>
      </Card>

      {/* WEEKLY CHARTS */}
      <Card glow={C.blue}>
        <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:4}}>📆 WEEKLY — Scorecard % (last 7 days)</div>
        <MiniBarChart data={weeklyScore} suffix="%"/>
      </Card>
      <Card glow={C.teal}>
        <div style={{color:C.teal,fontWeight:800,fontSize:13,marginBottom:4}}>📆 WEEKLY — MCQ Accuracy % (last 7 days)</div>
        <MiniBarChart data={weeklyMcqAcc} suffix="%"/>
      </Card>
      <Card glow={C.saffron}>
        <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:4}}>📆 WEEKLY — Focus Minutes (last 7 days)</div>
        <MiniBarChart data={weeklyFocusMin} color={C.saffron} suffix="m"/>
        <div style={{color:C.muted,fontSize:11,marginTop:6}}>Target: {goals.weeklyFocusHrsTarget}h/week · This week: {Math.round(weeklyFocusMin.reduce((a,d)=>a+d.value,0)/60*10)/10}h</div>
      </Card>

      {/* MONTHLY CHARTS */}
      <Card glow={C.purple}>
        <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:4}}>🗓️ MONTHLY — Avg Scorecard % (last 6 months)</div>
        <MiniBarChart data={monthlyScore} suffix="%"/>
      </Card>
      <Card glow={C.gold}>
        <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:4}}>🗓️ MONTHLY — MCQs Solved (last 6 months)</div>
        <MiniBarChart data={monthlyMcqVolume} color={C.gold} suffix=""/>
      </Card>
      <Card glow={C.green}>
        <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:4}}>🗓️ MONTHLY — Focus Hours (last 6 months)</div>
        <MiniBarChart data={monthlyFocusHrs} color={C.green} suffix="h"/>
      </Card>

      {/* ACCURACY TREND */}
      <Card glow={accTrendDelta===null?C.muted:accTrendDelta>=0?C.green:C.red}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{color:C.text,fontWeight:800,fontSize:13}}>📈 ACCURACY TREND (last 12 MCQ sessions)</div>
          {accTrendDelta!==null&&<span style={{color:accTrendDelta>=0?C.green:C.red,fontWeight:800,fontSize:12}}>{accTrendDelta>=0?"▲":"▼"} {Math.abs(accTrendDelta)}%</span>}
        </div>
        <MiniBarChart data={accuracyTrendData} suffix="%"/>
        <div style={{color:C.muted,fontSize:11,marginTop:6}}>{accTrendDelta===null?"Log at least 4 MCQ sessions to see a trend.":accTrendDelta>=0?"Accuracy is improving session-over-session.":"Accuracy dipped — revisit weak topics in Mistake Book."}</div>
      </Card>

      {/* PRODUCTIVITY TREND */}
      <Card glow={prodTrendDelta>=0?C.green:C.red}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{color:C.text,fontWeight:800,fontSize:13}}>⏱️ PRODUCTIVITY TREND (focus mins, last 14 days)</div>
          <span style={{color:prodTrendDelta>=0?C.green:C.red,fontWeight:800,fontSize:12}}>{prodTrendDelta>=0?"▲":"▼"} {Math.abs(prodTrendDelta)}m</span>
        </div>
        <MiniBarChart data={productivityTrendData} color={C.blue} suffix="m" height={80}/>
        <div style={{color:C.muted,fontSize:11,marginTop:6}}>Week 2 vs Week 1 total focus minutes.</div>
      </Card>

      {/* SUBJECT COMPARISON */}
      <Card glow={C.pink||C.purple}>
        <div style={{color:C.text,fontWeight:800,fontSize:13,marginBottom:12}}>📚 SUBJECT COMPARISON — MCQ Accuracy vs PYQ Coverage</div>
        {subjectCompare.map(s=>(
          <div key={s.subject} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.text}}>{s.subject}</span>
              <span style={{color:C.muted,fontSize:10}}>{s.sessions} MCQ sessions</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{color:C.teal,fontSize:9,width:36}}>MCQ</span>
              <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:s.mcqAcc+"%",background:C.teal}}/></div>
              <span style={{color:C.teal,fontSize:10,width:32,textAlign:"right"}}>{s.mcqAcc}%</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:C.purple,fontSize:9,width:36}}>PYQ</span>
              <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:s.pyqPct+"%",background:C.purple}}/></div>
              <span style={{color:C.purple,fontSize:10,width:32,textAlign:"right"}}>{s.pyqPct}%</span>
            </div>
          </div>
        ))}
      </Card>

      {/* MOCK SCORE TRAJECTORY (kept from original) */}
      {mockScores.length>0&&(
        <Card glow={mockTrend>=0?C.green:C.red}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{color:C.text,fontWeight:800,fontSize:13}}>🧪 MOCK SCORE TRAJECTORY</div>
            {mockScores.length>=2&&<span style={{color:mockTrend>=0?C.green:C.red,fontWeight:800,fontSize:12}}>{mockTrend>=0?"▲":"▼"} {Math.abs(mockTrend)}</span>}
          </div>
          <MiniBarChart data={mockScores.slice(-10).map(m=>({label:m.date.slice(5),value:m.score}))} color={C.blue}/>
        </Card>
      )}
      {/* ── DEEP WORK ANALYTICS ── */}
      <Card glow={C.purple}>
        <div style={{fontSize:12,color:C.purple,fontWeight:700,marginBottom:14,letterSpacing:1}}>🧠 DEEP WORK ANALYTICS</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[
            {label:"Total Deep Focus Hrs",val:totalFocusHrsAllTime+"h",color:C.purple},
            {label:"Weekly Focus Hrs",val:weeklyFocusMin.reduce((a,d)=>a+d.value,0)+"m",color:C.blue},
            {label:"Daily Avg Focus",val:(weeklyFocusMin.reduce((a,d)=>a+d.value,0)/7).toFixed(0)+"m",color:C.teal},
            {label:"Focus Goal Progress",val:Math.min(100,Math.round((weeklyFocusMin.reduce((a,d)=>a+d.value,0)/60)/(goals.weeklyFocusHrsTarget||20)*100))+"%",color:C.green},
          ].map((m,i)=>(
            <div key={i} style={{background:`${m.color}10`,border:`1px solid ${m.color}30`,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{color:m.color,fontWeight:900,fontSize:18}}>{m.val}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.purple,fontWeight:700,marginBottom:8}}>📊 Last 7 Days Deep Work (min)</div>
        <MiniBarChart data={weeklyFocusMin} color={C.purple} suffix="m"/>
        <div style={{marginTop:14,background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 12px"}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:6}}>🎯 DEEP WORK QUALITY TARGETS</div>
          {[
            {target:"Min 4 hrs deep work/day",check:weeklyFocusMin.length>0&&weeklyFocusMin[weeklyFocusMin.length-1]?.value>=240},
            {target:"No interruptions during Pomodoros",check:null},
            {target:"Phone off during Study Block 1",check:null},
            {target:"Weekly focus ≥ "+( goals.weeklyFocusHrsTarget||20)+"h target",check:weeklyFocusMin.reduce((a,d)=>a+d.value,0)/60>=(goals.weeklyFocusHrsTarget||20)},
          ].map((t,i)=>(
            <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:i<3?`1px solid ${C.border}`:"none",alignItems:"center"}}>
              <div style={{width:16,height:16,borderRadius:4,background:t.check===true?C.green:t.check===false?C.red:"rgba(255,255,255,0.1)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {t.check===true&&<span style={{fontSize:9,color:"#fff"}}>✓</span>}
                {t.check===false&&<span style={{fontSize:9,color:"#fff"}}>✕</span>}
              </div>
              <span style={{color:C.text,fontSize:11}}>{t.target}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


// ─── FLOW STATE TAB ───────────────────────────────────────────────────────────
function FlowStateTab(){
  const[nidraActive,setNidraActive]=useState(false);
  const[timeLeft,setTimeLeft]=useState(90*60);
  const[breathPhase,setBreathPhase]=useState("Inhale");
  useEffect(()=>{let t;if(nidraActive&&timeLeft>0)t=setInterval(()=>setTimeLeft(l=>l-1),1000);else if(timeLeft===0)setNidraActive(false);return()=>clearInterval(t);},[nidraActive,timeLeft]);
  useEffect(()=>{const t=setInterval(()=>setBreathPhase(p=>p==="Inhale"?"Exhale":"Inhale"),4000);return()=>clearInterval(t);},[]);
  return(
    <div>
      <SectionTitle icon="🧘" title="Flow State Studio" sub="Extreme focus requires extreme recovery."/>
      <Card glow={C.blue} style={{textAlign:"center",padding:28}}>
        <h3 style={{color:C.blue,margin:"0 0 20px 0",letterSpacing:2,fontSize:13,textTransform:"uppercase"}}>Visual Breathing Pacer</h3>
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:160}}>
          <div style={{width:breathPhase==="Inhale"?120:70,height:breathPhase==="Inhale"?120:70,borderRadius:"50%",background:`radial-gradient(circle,${C.blue},transparent 70%)`,border:`2px solid ${C.blue}`,transition:"all 4s ease",boxShadow:`0 0 ${breathPhase==="Inhale"?40:10}px ${C.blue}50`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:C.blue,fontWeight:700,fontSize:13}}>{breathPhase}</span>
          </div>
        </div>
        <p style={{color:C.muted,marginTop:10}}>Belly → Ribs → Chest (4s In, 4s Out) — Surya Nadi before important tasks.</p>
      </Card>
      <Card glow={C.purple} style={{textAlign:"center",padding:28}}>
        <h3 style={{color:C.purple,margin:"0 0 10px 0",letterSpacing:2,fontSize:13,textTransform:"uppercase"}}>Yoga Nidra Vault</h3>
        <p style={{color:C.muted,fontSize:13,marginBottom:20}}>90-min recovery. Locks out digital pollution.</p>
        <div style={{fontSize:52,fontWeight:900,color:C.text,fontFamily:"monospace",marginBottom:20,textShadow:`0 0 20px ${C.purple}60`}}>
          {Math.floor(timeLeft/60).toString().padStart(2,"0")}:{(timeLeft%60).toString().padStart(2,"0")}
        </div>
        <button onClick={()=>{if(!nidraActive)setTimeLeft(90*60);setNidraActive(!nidraActive);}} style={{background:nidraActive?"transparent":C.purple,border:`2px solid ${C.purple}`,color:nidraActive?C.purple:"#fff",padding:"12px 30px",borderRadius:30,fontSize:15,fontWeight:800,cursor:"pointer",transition:"0.3s"}}>
          {nidraActive?"⏸️ Pause":"▶️ Initiate 90-Min Recovery"}
        </button>
      </Card>
      <Card>
        <h3 style={{color:C.gold,fontSize:13,textTransform:"uppercase",marginBottom:16,letterSpacing:1}}>🌬️ Nadi Activation Reference</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:`rgba(255,107,53,0.08)`,border:`1px solid ${C.saffron}33`,borderRadius:10,padding:12}}>
            <div style={{color:C.saffron,fontWeight:700,fontSize:12}}>☀️ Surya Nadi (Before Tasks)</div>
            <div style={{color:C.muted,fontSize:11,marginTop:6,lineHeight:1.5}}>Block left nostril, breathe right only. 5-10 rounds. Activates alertness + logic.</div>
          </div>
          <div style={{background:`rgba(139,92,246,0.08)`,border:`1px solid ${C.purple}33`,borderRadius:10,padding:12}}>
            <div style={{color:C.purple,fontWeight:700,fontSize:12}}>🌙 Ida Nadi (Before Sleep)</div>
            <div style={{color:C.muted,fontSize:11,marginTop:6,lineHeight:1.5}}>Lie on left side OR breathe left nostril only. 10-15 min. Calms mind for deep sleep.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── VITALITY TAB ────────────────────────────────────────────────────────────
function VitalityTab(){
  const{data,set}=useEC();
  const vit=data.vitality||{waterLiters:0};
  const meals=data.vitalityMeals||[];
  return(
    <div>
      <SectionTitle icon="⚡" title="Nutrition & Vitality Matrix" sub="Cognitive load requires premium physical fuel."/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card glow={C.teal} style={{margin:0}}>
          <h3 style={{color:C.teal,fontSize:12,textTransform:"uppercase",marginBottom:16}}>Elevated Fuel Logs</h3>
          {meals.map((meal,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <input type="checkbox" style={{width:16,height:16,accentColor:C.teal}}/>
              <span style={{color:C.text,fontSize:12}}>{meal}</span>
            </div>
          ))}
        </Card>
        <Card glow={C.saffron} style={{margin:0}}>
          <h3 style={{color:C.saffron,fontSize:12,textTransform:"uppercase",marginBottom:16}}>Hydration Engine</h3>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,fontWeight:900,color:C.text}}>{vit.waterLiters}<span style={{fontSize:20,color:C.muted}}>L</span></div>
            <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",marginBottom:12,marginTop:8}}>
              <div style={{width:Math.min(100,(vit.waterLiters/4)*100)+"%",height:"100%",background:`linear-gradient(90deg,${C.blue},${C.teal})`,transition:"width 0.3s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:8}}>
              <button onClick={()=>set("vitality",{...vit,waterLiters:Math.max(0,parseFloat((vit.waterLiters-0.5).toFixed(1)))})} style={{background:"rgba(255,255,255,0.06)",border:"none",color:C.text,padding:"8px 16px",borderRadius:8,cursor:"pointer"}}>-</button>
              <button onClick={()=>set("vitality",{...vit,waterLiters:parseFloat((vit.waterLiters+0.5).toFixed(1))})} style={{background:C.blue,border:"none",color:"#fff",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:800}}>+500ml</button>
            </div>
          </div>
        </Card>
      </div>
      <Card style={{marginTop:16}}>
        <h3 style={{color:C.gold,fontSize:13,textTransform:"uppercase",marginBottom:12}}>Knorr Pre-Mock Protocol</h3>
        <p style={{color:C.muted,fontSize:13,lineHeight:1.7}}>Pre-Mock test nutrition must be light to prevent stomach slump. Boil 2 cups water, add Knorr soup base, stir 3 mins. Add black pepper for cognitive stimulation. Perfect 7:30 PM fuel — light, warm, sharp.</p>
      </Card>
      <Card>
        <h3 style={{color:C.green,fontSize:13,textTransform:"uppercase",marginBottom:12}}>Sujata Vitality Juice</h3>
        <p style={{color:C.muted,fontSize:13,lineHeight:1.7}}>Blitz: 1 apple + 1 amla + 1 inch ginger + 1 tsp turmeric + 250ml water. Drink 30 min before morning study block. Boosts focus, immunity, and sustained energy without caffeine crash.</p>
      </Card>
    </div>
  );
}

// ─── VOICE NOTES TAB ─────────────────────────────────────────────────────────
function VoiceNotesTab(){
  const{data,set}=useEC();
  const notes=data.voiceNotes||[];
  const addNote=newNote=>set("voiceNotes",[newNote,...notes]);
  const deleteNote=id=>set("voiceNotes",notes.filter(n=>n.id!==id));
  const[isRecording,setIsRecording]=useState(false);
  const[subject,setSubject]=useState("Agriculture");
  const mrRef=useRef(null);
  const chunksRef=useRef([]);
  const startRec=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      mrRef.current=new MediaRecorder(stream);
      chunksRef.current=[];
      mrRef.current.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      mrRef.current.onstop=()=>{
        const reader=new FileReader();
        reader.readAsDataURL(new Blob(chunksRef.current,{type:"audio/webm"}));
        reader.onloadend=()=>addNote({id:Date.now(),date:new Date().toLocaleString(),subject,audioBase64:reader.result});
        stream.getTracks().forEach(t=>t.stop());
      };
      mrRef.current.start();setIsRecording(true);
    }catch{alert("Mic access denied.");}
  };
  const stopRec=()=>{if(mrRef.current){mrRef.current.stop();setIsRecording(false);}};
  return(
    <div>
      <SectionTitle icon="🎙️" title="Voice Knowledge Hub" sub="Speak your revisions, tricks, and ideas instantly."/>
      <Card glow={isRecording?C.red:C.gold}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <select value={subject} onChange={e=>setSubject(e.target.value)} style={{...IS,flex:1}}>
            {["Agriculture","Quant","Reasoning","English","Computer","Punjab GK","Current Affairs","General","Idea"].map(s=><option key={s} style={{background:"#1a1a2e"}}>{s}</option>)}
          </select>
          <button onClick={isRecording?stopRec:startRec} style={{background:isRecording?"transparent":C.red,border:isRecording?`2px solid ${C.red}`:"none",color:isRecording?C.red:"#fff",borderRadius:30,padding:"12px 20px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>
            {isRecording?"⏹️ Stop & Save":"⏺️ Record"}
          </button>
        </div>
        {isRecording&&<div style={{color:C.red,fontSize:12,marginTop:10,textAlign:"center"}}>🔴 Recording... tap Stop when done</div>}
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {notes.filter(n=>n.audioBase64).length===0&&<Card><div style={{color:C.muted,fontSize:12,textAlign:"center"}}>No voice notes yet. Record one above!</div></Card>}
        {notes.filter(n=>n.audioBase64).map(note=>(
          <Card key={note.id} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div><span style={{color:C.gold,fontWeight:700,fontSize:12}}>{note.subject}</span><div style={{color:C.muted,fontSize:10,marginTop:2}}>{note.date}</div></div>
              <button onClick={()=>deleteNote(note.id)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,cursor:"pointer",borderRadius:6,padding:"4px 8px",fontSize:11}}>Delete</button>
            </div>
            <audio src={note.audioBase64} controls style={{width:"100%",height:36}}/>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── SELF-CONTROL TAB ─────────────────────────────────────────────────────────
function SelfControlTab(){
  const[open,setOpen]=useState(null);
  return(
    <div>
      <SectionTitle icon="🧲" title="Self-Control Science" sub="Dimag ka braking system samajhna zaroori hai — tabhi discipline permanent banti hai."/>
      <Card glow={C.purple} style={{background:"rgba(139,92,246,0.07)"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{fontSize:32}}>{SC_SCIENCE.icon}</div>
          <div>
            <div style={{color:C.purple,fontWeight:800,fontSize:14,marginBottom:4}}>{SC_SCIENCE.title}</div>
            <div style={{color:C.gold,fontSize:11,marginBottom:8}}>⏰ {SC_SCIENCE.time}</div>
            <div style={{color:C.text,fontSize:13,lineHeight:1.7}}>{SC_SCIENCE.detail}</div>
          </div>
        </div>
        <div style={{marginTop:14,background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"10px 14px"}}>
          <div style={{color:C.purple,fontWeight:700,fontSize:12,marginBottom:6}}>🔑 Key Insight for Atul:</div>
          <div style={{color:C.muted,fontSize:12,lineHeight:1.6}}>Jad tu 3 AM te phone check karda hai ya reels dekhda hai — tu apne frontal lobe nu kamzor kar raha hai. Agla din ka discipline directly affected hunda hai. Phone duur rakho = stronger willpower automatically.</div>
        </div>
      </Card>
      <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10,letterSpacing:1}}>🏛️ 4 MAIN RULES OF SELF-CONTROL</div>
      {SELF_CONTROL_RULES.map((rule,i)=>(
        <Card key={i} glow={rule.color} style={{cursor:"pointer"}} onClick={()=>setOpen(open===i?null:i)}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{fontSize:28,flexShrink:0}}>{rule.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:rule.color,fontWeight:800,fontSize:14}}>{i+1}. {rule.title}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:2}}>⏰ {rule.time}</div>
            </div>
            <div style={{color:rule.color,fontSize:16}}>{open===i?"−":"+"}</div>
          </div>
          {open===i&&(
            <div style={{marginTop:14,background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${rule.color}`}}>
              <div style={{color:C.text,fontSize:13,lineHeight:1.7}}>{rule.detail}</div>
            </div>
          )}
        </Card>
      ))}
      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:12,letterSpacing:1}}>⚙️ HOW THIS MAPS TO YOUR SCHEDULE</div>
        {[
          {rule:"Bolo Mat, Bano",apply:"3 AM alarm = trigger → table te immediate baith jao. No negotiation."},
          {rule:"Create Distance",apply:"Phone scroll karna chahunda si? 10 sec pause. Deep breath. Then decide consciously."},
          {rule:"Excuse Repeat Mat Karo",apply:"Ik din miss? Thik. Par same excuse doosre din nahi chalega. Emergency Min Day = solution."},
          {rule:"Sahi Battlefield",apply:"Raat nu books + table set karo, phone duur rakho. Subah 0 friction = guaranteed execution."},
        ].map((m,i)=>(
          <div key={i} style={{padding:"9px 0",borderBottom:i<3?`1px solid ${C.border}`:"none"}}>
            <div style={{color:C.gold,fontWeight:700,fontSize:12}}>{m.rule}</div>
            <div style={{color:C.text,fontSize:12,marginTop:3}}>→ {m.apply}</div>
          </div>
        ))}
      </Card>
      <Card style={{background:"linear-gradient(135deg,rgba(255,107,53,0.1),rgba(244,167,38,0.06))",border:`1px solid ${C.saffron}44`,textAlign:"center",padding:24}}>
        <div style={{fontSize:32,marginBottom:10}}>🧠</div>
        <div style={{color:C.saffron,fontWeight:900,fontSize:16,marginBottom:8}}>Daily Self-Control Check</div>
        <div style={{color:C.muted,fontSize:13,lineHeight:1.8}}>
          "Kya maine aaj apne frontal lobe nu strengthen kita ya weaken kita?"<br/>
          <span style={{color:C.green,fontWeight:700}}>Strengthen</span> = no mindless scroll, delayed gratification, 1 hard task done.<br/>
          <span style={{color:C.red,fontWeight:700}}>Weaken</span> = reels, excuse, snooze.
        </div>
      </Card>
      {/* ── ANTI-PROCRASTINATION RULES ── */}
      <Card glow={C.saffron} style={{background:"rgba(255,107,53,0.06)"}}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:14,letterSpacing:1}}>⚡ ANTI-PROCRASTINATION RULES</div>
        {[
          {icon:"⏱️",title:"Two-Minute Rule",detail:"Jado koi task 2 min ya ghat vich ho sake — turant karo. Delay bilkul nahi."},
          {icon:"5️⃣",title:"Five-Second Countdown",detail:"5-4-3-2-1 count karo te uth jao. Brain nu overthink karne da mauka mat do."},
          {icon:"🪜",title:"Start With The Smallest Step",detail:"Overwhelm feel hove toh sabse chhota step dhundho te sirf oh karo. Momentum khud aayega."},
          {icon:"🔄",title:"Never Miss Twice",detail:"Ik din miss hoyi — thik hai. Par dobara same habit miss = bad cycle. Bounce back instantly."},
          {icon:"🚀",title:"Make Starting Easy",detail:"Raat nu table set, books ready, phone duur. Subah 0 friction = guaranteed start."},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
            <div style={{fontSize:22,flexShrink:0}}>{r.icon}</div>
            <div>
              <div style={{color:C.saffron,fontWeight:700,fontSize:13}}>{r.title}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:3,lineHeight:1.5}}>{r.detail}</div>
            </div>
          </div>
        ))}
      </Card>
      {/* ── RECOVERY SYSTEM ── */}
      <Card glow={C.teal} style={{background:"rgba(20,184,166,0.06)"}}>
        <div style={{fontSize:12,color:C.teal,fontWeight:700,marginBottom:14,letterSpacing:1}}>♻️ RECOVERY SYSTEM</div>
        {[
          {icon:"🤸",title:"Stretching",detail:"Har study block baad 2-3 min light stretching — neck, shoulders, back. Tension release."},
          {icon:"🌬️",title:"Breathing",detail:"Belly → Ribs → Chest (4s in, 4s out). Turant reset. Use after pomodoros or stress spikes."},
          {icon:"🫁",title:"Massage / Foam Rolling (if available)",detail:"Deep tissue pressure on tight spots — shoulders, calves. Accelerates muscle recovery."},
          {icon:"🌙",title:"Digital Sunset Before Bed",detail:"9 PM baad screens band. Melatonin protect karo. Blue light = sleep killer."},
          {icon:"😴",title:"Recovery Day When Needed",detail:"Jado body ya mind completely drained feel kare — Emergency Min Day. No guilt, full reset."},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
            <div style={{fontSize:22,flexShrink:0}}>{r.icon}</div>
            <div>
              <div style={{color:C.teal,fontWeight:700,fontSize:13}}>{r.title}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:3,lineHeight:1.5}}>{r.detail}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── CONTENT PLAN TAB ─────────────────────────────────────────────────────────
function ContentPlanTab(){
  const{data,set}=useEC();
  const schedule=data.contentSchedule||[];
  const dayColors=["#8B5CF6","#3B82F6","#10B981","#F4A726","#EC4899","#FF6B35","#14B8A6"];
  return(
    <div>
      <SectionTitle icon="📆" title="YouTube + Facebook Content Plan" sub="Weekly content schedule — har din ka time aur topic fix. Sirf exam tasks complete hone baad."/>
      <Card glow={C.gold} style={{background:"rgba(244,167,38,0.07)"}}>
        <div style={{color:C.gold,fontWeight:700,fontSize:12,marginBottom:6}}>⚠️ GOLDEN RULE</div>
        <div style={{color:C.text,fontSize:13,lineHeight:1.6}}>YouTube + FB content work sirf tadi karna hai jad us din de SAB exam-related tasks mukk chuke hon. Agar koi topic/MCQs baaki ne → content shift to next slot. Exam first, always.</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,marginBottom:8,padding:"0 4px"}}>
        <div style={{color:C.muted,fontSize:11,fontWeight:700}}>Day</div>
        <div style={{color:C.gold,fontSize:11,fontWeight:700}}>🎥 YT Hours</div>
        <div style={{color:C.gold,fontSize:11,fontWeight:700}}>🎥 YT Topic</div>
        <div style={{color:C.blue,fontSize:11,fontWeight:700}}>📘 FB Hours</div>
        <div style={{color:C.blue,fontSize:11,fontWeight:700}}>📘 FB Topic</div>
      </div>
      {schedule.map((row,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,marginBottom:8,alignItems:"center"}}>
          <div style={{background:dayColors[i%7]+"22",border:`1px solid ${dayColors[i%7]}44`,borderRadius:8,padding:"8px 6px",textAlign:"center",color:dayColors[i%7],fontWeight:800,fontSize:12}}>{row.day.slice(0,3)}</div>
          <input style={{...IS,fontSize:12}} placeholder="hrs" value={row.ytHours||""} onChange={e=>set("contentSchedule",schedule.map((r,j)=>j===i?{...r,ytHours:e.target.value}:r))}/>
          <input style={{...IS,fontSize:12}} placeholder="topic..." value={row.ytTopic||""} onChange={e=>set("contentSchedule",schedule.map((r,j)=>j===i?{...r,ytTopic:e.target.value}:r))}/>
          <input style={{...IS,fontSize:12}} placeholder="hrs" value={row.fbHours||""} onChange={e=>set("contentSchedule",schedule.map((r,j)=>j===i?{...r,fbHours:e.target.value}:r))}/>
          <input style={{...IS,fontSize:12}} placeholder="topic..." value={row.fbTopic||""} onChange={e=>set("contentSchedule",schedule.map((r,j)=>j===i?{...r,fbTopic:e.target.value}:r))}/>
        </div>
      ))}
      <Card style={{marginTop:8}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:10}}>📊 WEEKLY TOTALS</div>
        <div style={{display:"flex",gap:16}}>
          {[{label:"🎥 YT Total",key:"ytHours",color:C.gold},{label:"📘 FB Total",key:"fbHours",color:C.blue}].map(f=>(
            <div key={f.key} style={{flex:1,background:f.color+"11",borderRadius:10,padding:12,textAlign:"center"}}>
              <div style={{color:f.color,fontSize:10,fontWeight:700,marginBottom:4}}>{f.label}</div>
              <div style={{color:C.text,fontWeight:900,fontSize:20}}>{schedule.reduce((sum,r)=>sum+(parseFloat(r[f.key])||0),0).toFixed(1)}h</div>
            </div>
          ))}
          <div style={{flex:1,background:C.green+"11",borderRadius:10,padding:12,textAlign:"center"}}>
            <div style={{color:C.green,fontSize:10,fontWeight:700,marginBottom:4}}>📅 Combined</div>
            <div style={{color:C.text,fontWeight:900,fontSize:20}}>{schedule.reduce((sum,r)=>sum+(parseFloat(r.ytHours)||0)+(parseFloat(r.fbHours)||0),0).toFixed(1)}h</div>
          </div>
        </div>
      </Card>
      <Card glow={C.green}>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:10}}>💡 CONTENT EFFICIENCY TIPS</div>
        {["Batch record: ik din vich 2-3 videos record karo to save editing time.","Content repurpose: YouTube long-form → FB short clips (3-5 min extracts).","Best FB posting times: 7-9 AM or 7-9 PM Punjab audience ke liye.","YouTube upload: Sunday 10 AM — community already active after rest.","Caption + thumbnail in 20 min: Canva template use karo, zero rethinking."].map((tip,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
            <span style={{color:C.green}}>→</span>
            <span style={{color:C.text,fontSize:12}}>{tip}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── IDEAS TAB ────────────────────────────────────────────────────────────────
function IdeasTab(){
  const{data,set}=useEC();
  const[newText,setNewText]=useState("");
  const[filter,setFilter]=useState("open");
  const ideas=data.ideas||[];
  const persist=v=>set("ideas",v);
  const add=()=>{if(!newText.trim())return;persist([...ideas,{id:Date.now()+Math.random(),text:newText.trim(),date:new Date().toDateString(),done:false}]);setNewText("");};
  const toggle=id=>persist(ideas.map(i=>i.id===id?{...i,done:!i.done}:i));
  const remove=id=>persist(ideas.filter(i=>i.id!==id));
  const filtered=ideas.filter(i=>filter==="open"?!i.done:i.done);
  return(
    <div>
      <SectionTitle icon="💡" title="Ideas Inbox" sub="Capture instantly. Review on Sunday."/>
      <Card glow={C.gold}>
        <div style={{display:"flex",gap:6}}>
          <input placeholder="Quick capture..." value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} style={{...IS,flex:1}}/>
          <button onClick={add} style={{background:C.saffron,color:"#fff",border:"none",borderRadius:8,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+</button>
        </div>
      </Card>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setFilter("open")} style={{flex:1,padding:8,borderRadius:8,border:"none",background:filter==="open"?C.blue:"rgba(255,255,255,0.06)",color:filter==="open"?"#fff":C.muted,fontWeight:700,cursor:"pointer",fontSize:12}}>📥 Open ({ideas.filter(i=>!i.done).length})</button>
        <button onClick={()=>setFilter("done")} style={{flex:1,padding:8,borderRadius:8,border:"none",background:filter==="done"?C.green:"rgba(255,255,255,0.06)",color:filter==="done"?"#fff":C.muted,fontWeight:700,cursor:"pointer",fontSize:12}}>✅ Done ({ideas.filter(i=>i.done).length})</button>
      </div>
      {filtered.length===0&&<Card><div style={{color:C.muted,fontSize:12,textAlign:"center"}}>{filter==="open"?"No open ideas. Capture one above!":"Nothing executed yet."}</div></Card>}
      {filtered.slice().reverse().map(idea=>(
        <Card key={idea.id} style={{background:idea.done?C.green+"08":C.card}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div onClick={()=>toggle(idea.id)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${idea.done?C.green:"rgba(255,255,255,0.2)"}`,background:idea.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              {idea.done&&<span style={{color:"#fff",fontSize:13,fontWeight:800}}>✓</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{color:idea.done?C.green:C.text,fontSize:13,textDecoration:idea.done?"line-through":"none"}}>{idea.text}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:3}}>{idea.date}</div>
            </div>
            <button onClick={()=>remove(idea.id)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:6,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>×</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── METRICS TAB (v26 — Persistent Storage Upgrade) ─────────────────────────
function MetricsTab(){
  const METRIC_KEY="metrics-daily-log";
  const WEEKLY_KEY="metrics-weekly-log";
  const MONTHLY_KEY="metrics-monthly-log";

  const [daily,setDaily]=useState({studyHrs:"",revision:"",mcqs:"",pyqs:"",anki:"",activeRecall:"",meditation:"",exercise:"",mockTests:""});
  const [weekly,setWeekly]=useState({mockScore:"",coverage:"",weakTopics:"",revisionDone:""});
  const [monthly,setMonthly]=useState({syllabusPct:"",mockTrend:"",weight:"",habitRating:""});
  const [history,setHistory]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [saved,setSaved]=useState(false);
  const [activeView,setActiveView]=useState("today");

  useEffect(()=>{
    (async()=>{
      const td=await stGet(METRIC_KEY+"-"+todayStr());
      if(td){setDaily(td.daily||daily);setWeekly(td.weekly||weekly);setMonthly(td.monthly||monthly);}
      const keys=await stList("metrics-daily-log-");
      const hist=[];
      for(const k of keys){const v=await stGet(k);if(v)hist.push({date:k.replace("metrics-daily-log-",""),...v});}
      hist.sort((a,b)=>b.date>a.date?1:-1);
      setHistory(hist);
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    const payload={daily,weekly,monthly,savedAt:Date.now()};
    await stSet(METRIC_KEY+"-"+todayStr(),payload);
    const keys=await stList("metrics-daily-log-");
    const hist=[];
    for(const k of keys){const v=await stGet(k);if(v)hist.push({date:k.replace("metrics-daily-log-",""),...v});}
    hist.sort((a,b)=>b.date>a.date?1:-1);
    setHistory(hist);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const dailyFields=[
    {k:"studyHrs",l:"📚 Study Hours",icon:"📚",color:C.green},
    {k:"revision",l:"🔄 Revision (hrs)",icon:"🔄",color:C.blue},
    {k:"mcqs",l:"🎯 MCQs Solved",icon:"🎯",color:C.gold},
    {k:"pyqs",l:"📜 PYQs Done",icon:"📜",color:C.purple},
    {k:"anki",l:"🎴 Anki Cards",icon:"🎴",color:C.saffron},
    {k:"activeRecall",l:"🧠 Active Recall (min)",icon:"🧠",color:C.teal},
    {k:"meditation",l:"🧘 Meditation (min)",icon:"🧘",color:C.pink},
    {k:"exercise",l:"💪 Exercise (min)",icon:"💪",color:C.green},
    {k:"mockTests",l:"🏆 Mock Tests",icon:"🏆",color:C.red},
  ];

  // Simple bar chart from last 7 days
  const chartData=history.slice(0,7).reverse();
  const maxVal=Math.max(...chartData.map(h=>parseFloat(h.daily?.studyHrs||0)),1);

  return(
    <div>
      <SectionTitle icon="📐" title="Metrics Dashboard" sub="Daily → Weekly → Monthly. Persistent. No guessing."/>

      {/* View toggle */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[{id:"today",l:"📅 Today"},{id:"history",l:"📊 History"},{id:"chart",l:"📈 Chart"}].map(v=>(
          <button key={v.id} onClick={()=>setActiveView(v.id)}
            style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",background:activeView===v.id?C.gold:"rgba(255,255,255,0.06)",color:activeView===v.id?"#000":"#fff",fontWeight:800,cursor:"pointer",fontSize:11}}>
            {v.l}
          </button>
        ))}
      </div>

      {activeView==="today"&&(
        <div>
          {/* Daily metrics */}
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:12}}>📅 TODAY — {todayStr()}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {dailyFields.map(f=>(
                <div key={f.k}>
                  <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.l}</div>
                  <input style={{...IS,borderColor:f.color+"44"}} value={daily[f.k]||""} onChange={e=>setDaily({...daily,[f.k]:e.target.value})} placeholder="0" type="number" min="0"/>
                </div>
              ))}
            </div>
          </Card>

          {/* Weekly */}
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:12}}>📆 WEEKLY REVIEW</div>
            <div style={{display:"grid",gap:8}}>
              {[{k:"mockScore",l:"Mock Score (%)"},{k:"coverage",l:"Coverage (%)"},{k:"weakTopics",l:"Weak Topics"},{k:"revisionDone",l:"Revision Done (%)"}].map(f=>(
                <div key={f.k}>
                  <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.l}</div>
                  <input style={IS} value={weekly[f.k]||""} onChange={e=>setWeekly({...weekly,[f.k]:e.target.value})} placeholder="Enter..."/>
                </div>
              ))}
            </div>
          </Card>

          {/* Monthly */}
          <Card glow={C.saffron}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:12}}>🗓️ MONTHLY OVERVIEW</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{k:"syllabusPct",l:"Syllabus % Done"},{k:"mockTrend",l:"Mock Trend"},{k:"weight",l:"Weight (kg)"},{k:"habitRating",l:"Habit Rating /10"}].map(f=>(
                <div key={f.k}>
                  <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.l}</div>
                  <input style={IS} value={monthly[f.k]||""} onChange={e=>setMonthly({...monthly,[f.k]:e.target.value})} placeholder="0"/>
                </div>
              ))}
            </div>
          </Card>

          <button onClick={save} style={{width:"100%",background:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#000",border:"none",borderRadius:12,padding:"14px 0",fontWeight:900,fontSize:14,cursor:"pointer",marginBottom:16}}>
            {saved?"✅ Saved!":"💾 Save Today's Metrics"}
          </button>
        </div>
      )}

      {activeView==="history"&&(
        <div>
          {history.length===0&&<Card><div style={{color:C.muted,textAlign:"center"}}>No entries yet. Save today's metrics first.</div></Card>}
          {history.map((h,i)=>(
            <Card key={i}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{color:C.gold,fontWeight:800,fontSize:13}}>📅 {h.date}</div>
                <div style={{color:C.muted,fontSize:10}}>{h.savedAt?new Date(h.savedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):""}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {dailyFields.map(f=>(
                  <div key={f.k} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                    <div style={{fontSize:16}}>{f.icon}</div>
                    <div style={{color:f.color,fontWeight:800,fontSize:14}}>{h.daily?.[f.k]||"0"}</div>
                    <div style={{color:C.muted,fontSize:9}}>{f.l.replace(/.*? /,"")}</div>
                  </div>
                ))}
              </div>
              {h.weekly?.mockScore&&<div style={{marginTop:8,color:C.blue,fontSize:11}}>Mock: {h.weekly.mockScore}% | Coverage: {h.weekly.coverage||"—"}%</div>}
            </Card>
          ))}
        </div>
      )}

      {activeView==="chart"&&(
        <div>
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:12}}>📚 Study Hours — Last 7 Days</div>
            {chartData.length===0?<div style={{color:C.muted,fontSize:12,textAlign:"center"}}>No data yet.</div>:(
              <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
                {chartData.map((h,i)=>{
                  const val=parseFloat(h.daily?.studyHrs||0);
                  const pct=maxVal>0?(val/maxVal)*90+5:5;
                  return(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <div style={{color:C.green,fontSize:10,fontWeight:700}}>{val}</div>
                      <div style={{width:"100%",height:pct+"%",background:`linear-gradient(0deg,${C.green}88,${C.green})`,borderRadius:"4px 4px 0 0",minHeight:4}}/>
                      <div style={{color:C.muted,fontSize:9,textAlign:"center"}}>{h.date.slice(8)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>🎯 MCQs Solved — Last 7 Days</div>
            {chartData.length===0?<div style={{color:C.muted,fontSize:12,textAlign:"center"}}>No data yet.</div>:(()=>{
              const maxM=Math.max(...chartData.map(h=>parseInt(h.daily?.mcqs||0)),1);
              return(
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
                  {chartData.map((h,i)=>{
                    const val=parseInt(h.daily?.mcqs||0);
                    const pct=maxM>0?(val/maxM)*85+5:5;
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{color:C.gold,fontSize:9,fontWeight:700}}>{val}</div>
                        <div style={{width:"100%",height:pct+"%",background:`linear-gradient(0deg,${C.gold}88,${C.gold})`,borderRadius:"4px 4px 0 0",minHeight:4}}/>
                        <div style={{color:C.muted,fontSize:9}}>{h.date.slice(8)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
          {/* Averages summary */}
          {history.length>0&&(
            <Card glow={C.purple}>
              <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:12}}>📊 All-Time Averages</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {l:"Study Hrs",key:"studyHrs",color:C.green},
                  {l:"MCQs",key:"mcqs",color:C.gold},
                  {l:"Anki",key:"anki",color:C.saffron},
                  {l:"Meditation",key:"meditation",color:C.pink},
                  {l:"Exercise",key:"exercise",color:C.teal},
                  {l:"PYQs",key:"pyqs",color:C.purple},
                ].map(m=>{
                  const vals=history.map(h=>parseFloat(h.daily?.[m.key]||0)).filter(v=>v>0);
                  const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:0;
                  return(
                    <div key={m.key} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{color:m.color,fontWeight:900,fontSize:18}}>{avg}</div>
                      <div style={{color:C.muted,fontSize:10,marginTop:2}}>{m.l}/day avg</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 🪞 REFLECTION SYSTEM ─────────────────────────────────────────────────────
// Reuses the existing DailyLog component (same one powering Metrics) — no new
// storage logic, no duplicate save/history code.
function ReflectionTab(){
  return(
    <div>
      <SectionTitle icon="🪞" title="Reflection System" sub="Morning intention → Evening review. Saved every day, fully editable."/>
      {/* ── DAILY BIG 3 ── */}
      <DailyLog
        storagePrefix="daily-big3"
        title="🎯 Daily Big 3"
        color={C.saffron}
        fields={[
          {key:"big1",label:"#1 Most Important Task (MIT)",placeholder:"The ONE thing that must get done today — no matter what..."},
          {key:"big2",label:"#2 Second Priority",placeholder:"If MIT is done, this is next..."},
          {key:"big3",label:"#3 Third Priority",placeholder:"Bonus execution if time allows..."},
          {key:"why",label:"Why does #1 matter today?",type:"textarea",placeholder:"Connect today's task to your bigger mission..."},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-morning"
        title="🌅 Morning Intention"
        color={C.saffron}
        fields={[
          {key:"intention",label:"Today I will focus on...",type:"textarea",placeholder:"Set your single most important intention for today..."},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-gratitude"
        title="🙏 Gratitude (3 Things)"
        color={C.gold}
        fields={[
          {key:"g1",label:"Grateful for #1",placeholder:"e.g. A supportive family"},
          {key:"g2",label:"Grateful for #2",placeholder:"e.g. Good health today"},
          {key:"g3",label:"Grateful for #3",placeholder:"e.g. A breakthrough in studies"},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-wins"
        title="🏆 Wins of the Day"
        color={C.green}
        fields={[
          {key:"wins",label:"What went right today?",type:"textarea",placeholder:"List even small wins — consistency, a tough topic cracked, discipline held..."},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-lessons"
        title="📘 Lessons Learned"
        color={C.blue}
        fields={[
          {key:"lessons",label:"What did today teach me?",type:"textarea",placeholder:"Mistakes, insights, what I'd do differently..."},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-evening"
        title="🌙 Evening Review"
        color={C.purple}
        fields={[
          {key:"review",label:"How did today really go?",type:"textarea",placeholder:"Honest review against this morning's intention..."},
          {key:"rating",label:"Day Rating /10",type:"number",placeholder:"e.g. 8"},
        ]}
      />
      <DailyLog
        storagePrefix="reflection-tomorrow"
        title="📋 Tomorrow's Plan"
        color={C.teal}
        fields={[
          {key:"plan",label:"Tomorrow's ONE main task",placeholder:"The single most important thing to execute tomorrow"},
          {key:"notes",label:"Other notes / prep needed",type:"textarea",placeholder:"Anything to prep tonight for a smooth 3 AM start..."},
        ]}
      />
      {/* ── DECISION JOURNAL ── */}
      <DailyLog
        storagePrefix="decision-journal"
        title="⚖️ Decision Journal"
        color={C.purple}
        fields={[
          {key:"decision",label:"Decision Made",placeholder:"What important decision did you make today?"},
          {key:"options",label:"Options Considered",type:"textarea",placeholder:"What were the alternatives you weighed?"},
          {key:"reasoning",label:"Why This Choice",type:"textarea",placeholder:"What logic or values drove this decision?"},
          {key:"expected",label:"Expected Outcome",placeholder:"What do you expect to happen?"},
          {key:"review",label:"Outcome (fill later)",type:"textarea",placeholder:"Come back and record what actually happened..."},
        ]}
      />
      {/* ── WIN & FAILURE JOURNAL ── */}
      <DailyLog
        storagePrefix="win-failure-journal"
        title="🏆 Win & Failure Journal"
        color={C.gold}
        fields={[
          {key:"win",label:"Today's Biggest Win 🏆",type:"textarea",placeholder:"What went right? What are you proud of? Even small wins count."},
          {key:"failure",label:"Today's Biggest Failure 💥",type:"textarea",placeholder:"What broke down? What slipped? Be brutally honest."},
          {key:"lesson",label:"Lesson Extracted",type:"textarea",placeholder:"What does this win or failure teach you for tomorrow?"},
          {key:"action",label:"One Action to Carry Forward",placeholder:"What single action will you take because of today?"},
        ]}
      />
      {/* ── MONTHLY RESET ── */}
      <MonthlyRecord
        storagePrefix="monthly-reset"
        title="🔄 Monthly Reset"
        color={C.pink}
        fields={[
          {key:"topWin",label:"Top Win of the Month",type:"textarea",placeholder:"The single biggest achievement this month..."},
          {key:"topFailure",label:"Top Failure & Lesson",type:"textarea",placeholder:"Biggest breakdown and what it taught you..."},
          {key:"habitScore",label:"Habit Consistency /10",type:"number",placeholder:"e.g. 7"},
          {key:"studyHrsAvg",label:"Avg Study Hrs/Day",type:"number",placeholder:"e.g. 6.5"},
          {key:"energyAvg",label:"Avg Energy /10",type:"number",placeholder:"e.g. 7"},
          {key:"bigFocus",label:"Next Month's #1 Focus",type:"textarea",placeholder:"What is the single most important priority for next month?"},
          {key:"dropList",label:"What to STOP / DROP",type:"textarea",placeholder:"Habits, behaviours, or activities to eliminate next month..."},
          {key:"addList",label:"What to START / ADD",type:"textarea",placeholder:"New habits or actions to introduce next month..."},
        ]}
      />
    </div>
  );
}

// ─── 👔 WEEKLY CEO REVIEW ─────────────────────────────────────────────────────
// Reuses the new WeeklyLog component (same save/history pattern as DailyLog,
// just keyed per ISO week) — no duplicate storage logic.
function WeeklyCEOReviewTab(){
  return(
    <div>
      <SectionTitle icon="👔" title="Weekly CEO Review" sub="Run your own life like a business. Once a week, review like a CEO."/>
      {/* ── TOP 1% META LOOP ── */}
      <Card glow={C.gold} style={{background:"linear-gradient(135deg,rgba(244,167,38,0.10),rgba(255,107,53,0.07))",border:`1px solid ${C.gold}55`,padding:20}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:28,marginBottom:6}}>🔁</div>
          <div style={{color:C.gold,fontWeight:900,fontSize:15,letterSpacing:1}}>TOP 1% META LOOP</div>
          <div style={{color:C.muted,fontSize:11,marginTop:4}}>Repeat this cycle every day — har din, bina rok.</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {step:1,icon:"📋",label:"Plan",detail:"Kal ki tayyari aaj raat. ONE main task fix karo. Table set, books ready.",color:C.blue},
            {step:2,icon:"⚡",label:"Execute",detail:"Deep work. No excuses. 3 AM te uth ke baith jao — no negotiation.",color:C.saffron},
            {step:3,icon:"📊",label:"Measure",detail:"Ki hoya aaj? MCQs, topics, hours — count karo. Feelings nahi, numbers.",color:C.green},
            {step:4,icon:"🪞",label:"Reflect",detail:"Kya kaam kita? Kya nahi kita? Honest ho. Ik line journal.",color:C.purple},
            {step:5,icon:"📈",label:"Improve",detail:"Ik chhoti cheez badlo kal layi. Sirf ik. Compound karda jaayega.",color:C.teal},
            {step:6,icon:"🔁",label:"Repeat",detail:"Kal fir. Fir. Fir. Consistency hi top 1% banata hai.",color:C.gold},
          ].map((s,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"center",background:`${s.color}10`,border:`1px solid ${s.color}30`,borderRadius:12,padding:"10px 14px"}}>
              <div style={{background:`${s.color}20`,border:`2px solid ${s.color}`,borderRadius:"50%",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{color:s.color,fontWeight:900,fontSize:13}}>{s.step}</span>
              </div>
              <div style={{fontSize:20,flexShrink:0}}>{s.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:s.color,fontWeight:800,fontSize:13}}>{s.label}</div>
                <div style={{color:C.muted,fontSize:11,marginTop:2,lineHeight:1.5}}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:16,background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
          <span style={{color:C.gold,fontWeight:800,fontSize:12}}>⚡ "Top 1% nahi bante ik din vich — bante ne roz ik loop naal."</span>
        </div>
      </Card>
      <WeeklyLog
        storagePrefix="ceo-review"
        title="CEO Review"
        color={C.gold}
        fields={[
          {key:"worked",label:"✅ What worked?",type:"textarea",placeholder:"Systems, habits, or decisions that paid off this week..."},
          {key:"didnt",label:"❌ What didn't work?",type:"textarea",placeholder:"What underperformed or broke down this week..."},
          {key:"mistake",label:"💥 Biggest mistake",type:"textarea",placeholder:"The single costliest mistake this week..."},
          {key:"win",label:"🏆 Biggest win",type:"textarea",placeholder:"The single biggest win this week..."},
          {key:"improvement",label:"🔧 One improvement for next week",type:"textarea",placeholder:"The ONE change that will move the needle most next week..."},
        ]}
      />
    </div>
  );
}

// ─── 🕉️ SPIRITUAL GROWTH ─────────────────────────────────────────────────────
// Reuses DailyChecklistGroup — no new storage/save logic.
function SpiritualGrowthTab(){
  return(
    <div>
      <SectionTitle icon="🕉️" title="Spiritual Growth" sub="The inner game. Tick honestly — this resets fresh every day."/>
      <DailyChecklistGroup
        storageKey="spiritual-growth"
        title="Spiritual Growth"
        icon="🕉️"
        color={C.purple}
        items={[
          "Meditation",
          "Prayer or gratitude",
          "Seva (service)",
          "Reading wisdom literature",
          "Living by personal values",
        ]}
      />
    </div>
  );
}

// ─── 🏠 ENVIRONMENT DESIGN ────────────────────────────────────────────────────
// Reuses DailyChecklistGroup — no new storage/save logic.
function EnvironmentDesignTab(){
  return(
    <div>
      <SectionTitle icon="🏠" title="Environment Design" sub="Discipline is easier when the environment is designed for it."/>
      <DailyChecklistGroup
        storageKey="environment-design"
        title="Environment Design"
        icon="🏠"
        color={C.teal}
        items={[
          "Clean workspace",
          "Prepared study desk",
          "Phone out of reach during deep work",
          "Healthy food visible",
          "Minimal distractions",
        ]}
      />
    </div>
  );
}

// ─── 🗂️ KNOWLEDGE MANAGEMENT / SECOND BRAIN ──────────────────────────────────
const KB_TAGS=["💡 Idea","📘 Concept","📌 Reference","✅ Action","🔬 Research","📖 Lesson","⭐ Insight"];
const KB_TAG_COLORS={
  "💡 Idea":C.gold,"📘 Concept":C.blue,"📌 Reference":C.teal,
  "✅ Action":C.green,"🔬 Research":C.purple,"📖 Lesson":C.saffron,"⭐ Insight":C.pink,
};
const KB_TEMPLATES=[
  {icon:"📝",label:"Meeting Note",text:"Meeting: \nDate: {{date}}\nAttendees: \n\nKey Points:\n- \n\nDecisions Made:\n- \n\nFollow-ups / Actions:\n- "},
  {icon:"🧠",label:"Concept Note",text:"Concept: \nDefinition: \n\nWhy It Matters: \n\nExample: \n\nRelated Topics: "},
  {icon:"📖",label:"Reading Note",text:"Source / Book: \nAuthor: \nDate Read: {{date}}\n\nKey Takeaway: \n\nBest Quote: \n\nHow I'll Apply This: "},
  {icon:"✅",label:"Action Item",text:"Task: \nDeadline: \nPriority: High / Medium / Low\n\nWhy It Matters: \n\nFirst Step: \n\nDone? [ ]"},
  {icon:"🔬",label:"Research Note",text:"Topic: \nDate: {{date}}\nSource: \n\nFindings:\n- \n\nConclusion: \n\nNext Steps: "},
  {icon:"⭐",label:"Daily Insight",text:"Date: {{date}}\nInsight: \n\nWhere it came from: \n\nHow I'll use it: "},
];

function KnowledgeManagementTab(){
  const[notes,setNotes]=useState([]);
  const[notesLoaded,setNotesLoaded]=useState(false);
  const[draft,setDraft]=useState("");
  const[draftTag,setDraftTag]=useState(KB_TAGS[0]);
  const[draftTitle,setDraftTitle]=useState("");
  const[query,setQuery]=useState("");
  const[filterTag,setFilterTag]=useState("All");
  const[activeSection,setActiveSection]=useState("capture");
  const[archiveCounts,setArchiveCounts]=useState({full:0,tab:0});
  const[editingId,setEditingId]=useState(null);
  const[editText,setEditText]=useState("");
  const[ideaInbox,setIdeaInbox]=useState([]);
  const[ideaDraft,setIdeaDraft]=useState("");
  const[ideasLoaded,setIdeasLoaded]=useState(false);
  const[savedCount,setSavedCount]=useState(null);

  const load=async()=>{
    const keys=await stList("kb-notes:");
    const loaded2=[];
    for(const k of keys){const v=await stGet(k);if(v)loaded2.push(v);}
    loaded2.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.savedAt-a.savedAt);
    setNotes(loaded2);setNotesLoaded(true);
    const fk=await stList(ARCHIVE_FULL_PREFIX);
    const tk=await stList(ARCHIVE_TAB_PREFIX);
    setArchiveCounts({full:fk.length,tab:tk.length});
  };

  const loadIdeas=async()=>{
    const v=await stGet("kb-idea-inbox");
    setIdeaInbox(v||[]);setIdeasLoaded(true);
  };

  useEffect(()=>{load();loadIdeas();},[]);

  // ── Notes CRUD ──
  const saveNote=async()=>{
    if(!draft.trim())return;
    const id="kb-notes:"+Date.now();
    const note={id,title:draftTitle.trim()||"",text:draft.trim(),tag:draftTag,date:todayStr(),savedAt:Date.now(),pinned:false};
    await stSet(id,note);
    setDraft("");setDraftTitle("");
    setSavedCount(c=>(c||0)+1);
    setTimeout(()=>setSavedCount(null),1800);
    load();
  };

  const deleteNote=async id=>{await stDel(id);load();};

  const togglePin=async(note)=>{
    await stSet(note.id,{...note,pinned:!note.pinned});load();
  };

  const startEdit=(note)=>{setEditingId(note.id);setEditText(note.text);};
  const saveEdit=async(note)=>{
    await stSet(note.id,{...note,text:editText,savedAt:Date.now()});
    setEditingId(null);setEditText("");load();
  };

  const loadTemplate=(t)=>{
    setDraft(t.text.replace(/\{\{date\}\}/g,todayStr()));
    setDraftTitle(t.label);
    setActiveSection("capture");
  };

  // ── Idea Inbox CRUD ──
  const addIdea=async()=>{
    if(!ideaDraft.trim())return;
    const updated=[{id:Date.now(),text:ideaDraft.trim(),date:todayStr(),done:false},...ideaInbox];
    await stSet("kb-idea-inbox",updated);
    setIdeaInbox(updated);setIdeaDraft("");
  };
  const toggleIdeaDone=async(id)=>{
    const updated=ideaInbox.map(i=>i.id===id?{...i,done:!i.done}:i);
    await stSet("kb-idea-inbox",updated);setIdeaInbox(updated);
  };
  const deleteIdea=async(id)=>{
    const updated=ideaInbox.filter(i=>i.id!==id);
    await stSet("kb-idea-inbox",updated);setIdeaInbox(updated);
  };
  const promoteIdea=async(idea)=>{
    // Promote idea → becomes a note in Second Brain
    const id="kb-notes:"+Date.now();
    await stSet(id,{id,title:"Promoted Idea",text:idea.text,tag:"💡 Idea",date:todayStr(),savedAt:Date.now(),pinned:false});
    await deleteIdea(idea.id);
    load();
    setActiveSection("notes");
  };

  // ── Filter / search ──
  const allTags=["All",...KB_TAGS];
  const filtered=notes.filter(n=>{
    const matchTag=filterTag==="All"||n.tag===filterTag;
    if(!matchTag)return false;
    if(!query.trim())return true;
    const q=query.toLowerCase();
    return n.text.toLowerCase().includes(q)||(n.title||"").toLowerCase().includes(q)||n.tag.toLowerCase().includes(q)||n.date.includes(q);
  });

  const byTag={};notes.forEach(n=>{byTag[n.tag]=(byTag[n.tag]||0)+1;});
  const pinned=filtered.filter(n=>n.pinned);
  const unpinned=filtered.filter(n=>!n.pinned);
  const sortedFiltered=[...pinned,...unpinned];

  const SECTIONS=[
    {id:"capture",icon:"⚡",label:"Capture"},
    {id:"notes",icon:"🔍",label:"Notes"},
    {id:"templates",icon:"📑",label:"Templates"},
    {id:"inbox",icon:"💡",label:"Idea Inbox"},
    {id:"archive",icon:"🗄️",label:"Archive"},
  ];

  return(
    <div>
      <SectionTitle icon="🗂️" title="Knowledge Management" sub="Your Second Brain — capture fast, find later, never lose an idea."/>

      {/* BRAIN STATS BAR */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {[
          {icon:"📝",label:"Notes",value:notes.length,color:C.teal},
          {icon:"📌",label:"Pinned",value:notes.filter(n=>n.pinned).length,color:C.gold},
          {icon:"💡",label:"Ideas",value:ideaInbox.filter(i=>!i.done).length,color:C.purple},
          {icon:"🗄️",label:"Archives",value:archiveCounts.full,color:C.blue},
        ].map((s,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${s.color}33`,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:16}}>{s.icon}</div>
            <div style={{color:s.color,fontWeight:900,fontSize:18,marginTop:2}}>{s.value}</div>
            <div style={{color:C.muted,fontSize:9,marginTop:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SECTION NAV */}
      <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{flex:1,minWidth:60,padding:"9px 6px",borderRadius:10,border:`1px solid ${activeSection===s.id?C.teal+"88":C.border}`,
              background:activeSection===s.id?`${C.teal}22`:"transparent",
              color:activeSection===s.id?C.teal:C.muted,fontWeight:700,cursor:"pointer",fontSize:10,whiteSpace:"nowrap"}}>
            {s.icon}<br/>{s.label}
            {s.id==="inbox"&&ideaInbox.filter(i=>!i.done).length>0&&(
              <span style={{marginLeft:3,background:C.purple,color:"#fff",borderRadius:"50%",fontSize:8,padding:"1px 4px",fontWeight:900}}>
                {ideaInbox.filter(i=>!i.done).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SECTION: QUICK CAPTURE ── */}
      {activeSection==="capture"&&(
        <div>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>⚡ QUICK CAPTURE</div>
            <input value={draftTitle} onChange={e=>setDraftTitle(e.target.value)}
              style={{...IS,marginBottom:8,fontWeight:700,fontSize:13}} placeholder="Title (optional)..."/>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)}
              style={{...IS,minHeight:100,resize:"vertical",marginBottom:8,lineHeight:1.6}}
              placeholder="Capture a thought, note, insight, or concept before it disappears..."/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <select value={draftTag} onChange={e=>setDraftTag(e.target.value)} style={{...IS,flex:1,minWidth:120,background:"#111122"}}>
                {KB_TAGS.map(t=><option key={t} style={{background:"#1a1a2e"}}>{t}</option>)}
              </select>
              <button onClick={saveNote}
                style={{background:`linear-gradient(135deg,${C.gold},${C.saffron})`,color:"#000",border:"none",borderRadius:8,
                  padding:"9px 20px",fontWeight:900,cursor:"pointer",fontSize:13,whiteSpace:"nowrap",
                  boxShadow:`0 4px 16px ${C.gold}44`}}>
                {savedCount!==null?"✓ Saved!":"💾 Save to Brain"}
              </button>
            </div>
            {draft.trim()&&(
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:KB_TAG_COLORS[draftTag]||C.gold,flexShrink:0}}/>
                <span style={{color:C.muted,fontSize:11}}>{draftTag} • {todayStr()}</span>
                <span style={{color:C.muted,fontSize:11,marginLeft:"auto"}}>{draft.length} chars</span>
              </div>
            )}
          </Card>

          {/* Tip row */}
          <Card style={{padding:"10px 14px"}}>
            <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
              <span style={{color:C.teal,fontWeight:800}}>💡 Tip: </span>
              Use Templates tab to load structured note formats. Switch to Notes tab to search and manage all saved notes.
              Pin important notes 📌 so they always appear at top.
            </div>
          </Card>
        </div>
      )}

      {/* ── SECTION: SEARCHABLE NOTES ── */}
      {activeSection==="notes"&&(
        <div>
          <Card glow={C.teal}>
            <div style={{color:C.teal,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>🔍 SEARCH YOUR SECOND BRAIN ({notes.length} notes)</div>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              style={{...IS,marginBottom:10,fontSize:13}} placeholder="🔍 Search by text, tag, title, or date..."/>
            {/* Tag filter pills */}
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
              {allTags.map(t=>{
                const cnt=t==="All"?notes.length:(byTag[t]||0);
                if(t!=="All"&&cnt===0)return null;
                const active=filterTag===t;
                return(
                  <span key={t} onClick={()=>setFilterTag(t)}
                    style={{cursor:"pointer",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,
                      background:active?(KB_TAG_COLORS[t]||C.teal)+"33":"rgba(255,255,255,0.05)",
                      border:`1px solid ${active?(KB_TAG_COLORS[t]||C.teal)+"66":C.border}`,
                      color:active?(KB_TAG_COLORS[t]||C.teal):C.muted}}>
                    {t} {cnt>0&&`(${cnt})`}
                  </span>
                );
              })}
            </div>
          </Card>

          {/* Notes list */}
          {!notesLoaded&&<Card><div style={{color:C.muted,textAlign:"center",padding:"20px 0"}}>Loading your brain...</div></Card>}
          {notesLoaded&&sortedFiltered.length===0&&(
            <Card>
              <div style={{color:C.muted,textAlign:"center",padding:"20px 0",fontSize:13}}>
                {notes.length===0?"No notes yet — go to Capture and save your first thought! 🧠":"No notes match your search or filter."}
              </div>
            </Card>
          )}
          {sortedFiltered.map(n=>{
            const tagColor=KB_TAG_COLORS[n.tag]||C.teal;
            const isEditing=editingId===n.id;
            return(
              <Card key={n.id} style={{padding:"12px 14px",borderLeft:`3px solid ${tagColor}`,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    {n.title&&<div style={{color:C.text,fontWeight:800,fontSize:13,marginBottom:3}}>{n.title}</div>}
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,
                        background:tagColor+"22",border:`1px solid ${tagColor}44`,color:tagColor}}>{n.tag}</span>
                      <span style={{color:C.muted,fontSize:10}}>{n.date}</span>
                      {n.pinned&&<span style={{color:C.gold,fontSize:10,fontWeight:700}}>📌 Pinned</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <button onClick={()=>togglePin(n)}
                      style={{background:n.pinned?C.gold+"22":"rgba(255,255,255,0.05)",border:`1px solid ${n.pinned?C.gold+"44":C.border}`,
                        color:n.pinned?C.gold:C.muted,borderRadius:6,padding:"3px 7px",fontSize:10,cursor:"pointer"}} title="Pin/Unpin">📌</button>
                    <button onClick={()=>isEditing?saveEdit(n):startEdit(n)}
                      style={{background:isEditing?C.green+"22":"rgba(255,255,255,0.05)",border:`1px solid ${isEditing?C.green+"44":C.border}`,
                        color:isEditing?C.green:C.muted,borderRadius:6,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>
                      {isEditing?"✓ Save":"✏️"}
                    </button>
                    <button onClick={()=>deleteNote(n.id)}
                      style={{background:"rgba(239,68,68,0.1)",border:"none",color:C.red,borderRadius:6,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button>
                  </div>
                </div>
                {isEditing?(
                  <textarea value={editText} onChange={e=>setEditText(e.target.value)}
                    style={{...IS,minHeight:80,resize:"vertical",fontSize:12,lineHeight:1.6,marginTop:4}}/>
                ):(
                  <div style={{color:C.text,fontSize:12,whiteSpace:"pre-wrap",lineHeight:1.6,marginTop:4,
                    maxHeight:200,overflowY:"auto"}}>{n.text}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── SECTION: TEMPLATES ── */}
      {activeSection==="templates"&&(
        <div>
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:12,marginBottom:4,letterSpacing:1}}>📑 NOTE TEMPLATES</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:14}}>Tap any template to load it into Quick Capture. Saves time, keeps notes consistent.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {KB_TEMPLATES.map((t,i)=>(
                <div key={i} style={{background:"rgba(59,130,246,0.07)",border:`1px solid ${C.blue}22`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{color:C.blue,fontWeight:800,fontSize:13}}>{t.icon} {t.label}</div>
                    <button onClick={()=>loadTemplate(t)}
                      style={{background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",border:"none",
                        borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:800,cursor:"pointer"}}>
                      Use Template →
                    </button>
                  </div>
                  <div style={{color:C.muted,fontSize:10,fontFamily:"monospace",whiteSpace:"pre-wrap",
                    background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"6px 8px",lineHeight:1.5,maxHeight:80,overflowY:"auto"}}>
                    {t.text.replace("{{date}}",todayStr())}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{padding:"10px 14px"}}>
            <div style={{color:C.muted,fontSize:11}}>
              <span style={{color:C.gold,fontWeight:800}}>Pro tip: </span>
              After loading a template, customize the draft in Quick Capture and tag it correctly before saving.
            </div>
          </Card>
        </div>
      )}

      {/* ── SECTION: IDEA INBOX ── */}
      {activeSection==="inbox"&&(
        <div>
          <Card glow={C.purple}>
            <div style={{color:C.purple,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>💡 IDEA INBOX — Raw Ideas, Unfiltered</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Dump raw ideas here instantly. Process later — promote to Notes or mark done.</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={ideaDraft} onChange={e=>setIdeaDraft(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&ideaDraft.trim())addIdea();}}
                style={{...IS,flex:1}} placeholder="💡 Quick idea... (Enter to add)"/>
              <button onClick={addIdea}
                style={{background:C.purple,color:"#fff",border:"none",borderRadius:8,
                  padding:"9px 16px",fontWeight:900,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
            </div>
            {!ideasLoaded&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>Loading...</div>}
            {ideasLoaded&&ideaInbox.length===0&&(
              <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"20px 0"}}>Idea inbox empty! Add your first raw idea above. 💡</div>
            )}
            {ideaInbox.map(idea=>(
              <div key={idea.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",
                borderBottom:`1px solid ${C.border}`,opacity:idea.done?0.5:1}}>
                <div onClick={()=>toggleIdeaDone(idea.id)}
                  style={{width:18,height:18,borderRadius:5,border:`2px solid ${idea.done?C.green:C.purple}`,
                    background:idea.done?C.green:"transparent",cursor:"pointer",flexShrink:0,marginTop:2,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {idea.done&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{color:idea.done?C.muted:C.text,fontSize:13,textDecoration:idea.done?"line-through":"none",lineHeight:1.5}}>{idea.text}</div>
                  <div style={{color:C.muted,fontSize:10,marginTop:2}}>{idea.date}</div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  {!idea.done&&(
                    <button onClick={()=>promoteIdea(idea)}
                      style={{background:`${C.teal}22`,border:`1px solid ${C.teal}44`,color:C.teal,
                        borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:700}} title="Promote to Second Brain">
                      🧠 Promote
                    </button>
                  )}
                  <button onClick={()=>deleteIdea(idea.id)}
                    style={{background:"rgba(239,68,68,0.1)",border:"none",color:C.red,borderRadius:6,
                      padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✕</button>
                </div>
              </div>
            ))}
            {ideaInbox.some(i=>i.done)&&(
              <button onClick={async()=>{
                const updated=ideaInbox.filter(i=>!i.done);
                await stSet("kb-idea-inbox",updated);setIdeaInbox(updated);
              }} style={{marginTop:12,background:"rgba(239,68,68,0.1)",border:`1px solid ${C.red}33`,
                color:C.red,borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                🗑️ Clear Done Ideas
              </button>
            )}
          </Card>
          <Card style={{padding:"10px 14px"}}>
            <div style={{color:C.muted,fontSize:11,lineHeight:1.6}}>
              <span style={{color:C.purple,fontWeight:800}}>Workflow: </span>
              Add raw ideas here quickly → review weekly → 🧠 Promote the good ones to your Second Brain (Notes) → mark rest as Done.
            </div>
          </Card>
        </div>
      )}

      {/* ── SECTION: ARCHIVE ── */}
      {activeSection==="archive"&&(
        <div>
          <Card glow={C.purple} style={{textAlign:"center",padding:"20px 16px"}}>
            <div style={{fontSize:40,marginBottom:8}}>🗄️</div>
            <div style={{color:C.purple,fontWeight:900,fontSize:16,marginBottom:12}}>Knowledge Archive</div>
            <div style={{display:"flex",justifyContent:"center",gap:24,marginBottom:16}}>
              <div>
                <div style={{fontSize:36,fontWeight:900,color:C.purple}}>{archiveCounts.full}</div>
                <div style={{color:C.muted,fontSize:12}}>Full-day snapshots</div>
              </div>
              <div style={{width:1,background:C.border}}/>
              <div>
                <div style={{fontSize:36,fontWeight:900,color:C.blue}}>{archiveCounts.tab}</div>
                <div style={{color:C.muted,fontSize:12}}>Per-tab snapshots</div>
              </div>
              <div style={{width:1,background:C.border}}/>
              <div>
                <div style={{fontSize:36,fontWeight:900,color:C.teal}}>{notes.length}</div>
                <div style={{color:C.muted,fontSize:12}}>KB Notes saved</div>
              </div>
            </div>
            <div style={{color:C.muted,fontSize:12,lineHeight:1.7,textAlign:"left",background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"10px 14px"}}>
              Every save across the app creates a dated snapshot automatically. Open the{" "}
              <b style={{color:C.text}}>Daily Storage</b> tab to browse, restore, or export any past day's full state.
            </div>
          </Card>

          {/* KB Notes archive — deleted notes notice */}
          <Card glow={C.teal}>
            <div style={{color:C.teal,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>📝 KB NOTES SUMMARY</div>
            {KB_TAGS.map(tag=>{
              const cnt=notes.filter(n=>n.tag===tag).length;
              if(cnt===0)return null;
              const col=KB_TAG_COLORS[tag]||C.teal;
              return(
                <div key={tag} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0}}/>
                    <span style={{color:C.text,fontSize:12}}>{tag}</span>
                  </div>
                  <span style={{color:col,fontWeight:800,fontSize:13}}>{cnt} notes</span>
                </div>
              );
            })}
            {notes.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No notes yet. Go to Capture to add your first!</div>}
          </Card>

          <Card style={{padding:"12px 14px"}}>
            <div style={{color:C.muted,fontSize:11,lineHeight:1.7}}>
              <span style={{color:C.gold,fontWeight:800}}>📌 Archive Rules: </span>
              KB Notes are stored indefinitely in your browser storage. Daily Storage tab snapshots are created on every app save. To free up space, delete old notes from the Notes tab or old snapshots from Daily Storage.
            </div>
          </Card>

          {/* ── SECOND BRAIN / KNOWLEDGE GRAPH ── */}
          <Card glow={C.teal} style={{marginTop:4}}>
            <div style={{fontSize:12,color:C.teal,fontWeight:700,marginBottom:14,letterSpacing:1}}>🧠 SECOND BRAIN — KNOWLEDGE GRAPH</div>
            <div style={{marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                {KB_TAGS.filter(t=>t!=="All").map(tag=>{const count=notes.filter(n=>n.tag===tag).length;return(
                  <div key={tag} style={{background:"rgba(20,184,166,0.08)",border:`1px solid ${C.teal}30`,borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.teal,fontWeight:700,marginBottom:2}}>{tag}</div>
                    <div style={{fontSize:16,fontWeight:900,color:count>0?C.text:C.muted}}>{count}</div>
                  </div>
                );})}
              </div>
            </div>
            <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
              <div style={{fontSize:11,color:C.teal,fontWeight:700,marginBottom:8}}>🔗 KNOWLEDGE CONNECTIONS</div>
              {["Agriculture ↔ Punjab GK: Govt schemes, MSP, NABARD schemes","Quant ↔ Computer: Data interpretation + spreadsheet logic","Current Affairs ↔ All subjects: Daily news anchored to syllabus","English ↔ All: Vocabulary from every subject's key terms","PYQs → every subject: Highest-signal revision always"].map((link,i)=>(
                <div key={i} style={{display:"flex",gap:6,padding:"4px 0",borderBottom:i<4?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
                  <span style={{color:C.teal,fontSize:12,flexShrink:0}}>↗</span>
                  <span style={{color:C.text,fontSize:11,lineHeight:1.5}}>{link}</span>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:8}}>⚡ SECOND BRAIN CAPTURE RULES</div>
              {["Capture everything — no idea too small. Filter later, capture now.","One note = one idea. Never mix multiple concepts in one card.","Always tag on creation. Untagged notes die in the archive.","Pinned notes = your active working memory. Keep ≤10 pinned.","Weekly Sunday: review inbox, promote ideas, delete clutter.","Promote ideas → notes only when actionable or worth revisiting."].map((rule,i)=>(
                <div key={i} style={{display:"flex",gap:6,padding:"4px 0",borderBottom:i<5?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
                  <span style={{color:C.gold,fontSize:12,flexShrink:0}}>{i+1}.</span>
                  <span style={{color:C.text,fontSize:11,lineHeight:1.5}}>{rule}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── 😊 HAPPINESS SYSTEM ──────────────────────────────────────────────────────
const HAPPINESS_PILLARS=[
  {id:"smile",    icon:"😊", label:"Smile Intentionally",  color:"#F4A726", tip:"Smile at yourself in the mirror every morning. Fake it till it's real — the brain follows the face.", quote:"A smile is the shortest distance between two people."},
  {id:"family",   icon:"❤️",  label:"Family Time",           color:"#EC4899", tip:"Give full attention during family time — no phone, no study thoughts. 15 min of real presence > 2 hrs of distracted sitting.", quote:"Family is where life begins and love never ends."},
  {id:"friends",  icon:"🤝", label:"Friends",               color:"#3B82F6", tip:"Send one genuine message to a friend today. Real connection doesn't need hours — it needs intention.", quote:"A good friend is a connection to life."},
  {id:"hobbies",  icon:"🎨", label:"Hobbies",               color:"#8B5CF6", tip:"Pick one hobby that has zero productivity pressure — something you do just because it feels alive. Guard that time fiercely.", quote:"Hobbies are happiness in disguise."},
  {id:"music",    icon:"🎵", label:"Music",                  color:"#14B8A6", tip:"Use music as medicine — high-energy before study, calm during breaks, devotional before sleep. Curate your playlists.", quote:"Where words fail, music speaks."},
  {id:"nature",   icon:"🌿", label:"Time in Nature",         color:"#10B981", tip:"Sunset walk, morning air, barefoot on grass — 10 mins in nature resets cortisol faster than any supplement.", quote:"In nature, nothing is perfect — and everything is perfect."},
  {id:"wins",     icon:"🏆", label:"Celebrate Small Wins",  color:"#FF6B35", tip:"Every topic covered, every MCQ session done, every early wake — acknowledge it out loud. 'I did that.' Growth is built on noticed moments.", quote:"Big things are just small wins compounded."},
  {id:"help",     icon:"🌟", label:"Help Someone Each Day",  color:"#F59E0B", tip:"One small act of help daily — a kind word, carrying something, sharing knowledge. Service is the fastest way to feel good about yourself.", quote:"We rise by lifting others."},
];

function HappinessTab(){
  const{data,set}=useEC();
  const IS={background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:12,width:"100%",boxSizing:"border-box",outline:"none"};

  // Daily checklist state (per day)
  const todayKey="happiness-daily-"+todayStr();
  const[checks,setChecks]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[journalText,setJournalText]=useState("");
  const[journalSaved,setJournalSaved]=useState(false);
  const[winText,setWinText]=useState("");
  const[wins,setWins]=useState([]);
  const[helpText,setHelpText]=useState("");
  const[helps,setHelps]=useState([]);
  const[mood,setMood]=useState(null);
  const[streak,setStreak]=useState(0);
  const[activePillar,setActivePillar]=useState(null);

  const load=async()=>{
    const d=await stGet(todayKey)||{};
    setChecks(d.checks||{});
    setMood(d.mood||null);
    setJournalText(d.journal||"");
    const w=await stGet("happiness-wins")||[];
    setWins(w);
    const h=await stGet("happiness-helps")||[];
    setHelps(h);
    // streak: count consecutive days with at least 3 pillars checked
    let s=0;
    const now=new Date();
    for(let i=0;i<60;i++){
      const d2=new Date(now);d2.setDate(now.getDate()-i);
      const dk=`happiness-daily-${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,"0")}-${String(d2.getDate()).padStart(2,"0")}`;
      const rec=await stGet(dk);
      const cnt=rec?Object.values(rec.checks||{}).filter(Boolean).length:0;
      if(cnt>=3)s++;else if(i>0)break;
    }
    setStreak(s);
    setLoaded(true);
  };
  useEffect(()=>{load();},[]);

  const saveDayData=async(updated)=>{
    const current=await stGet(todayKey)||{};
    await stSet(todayKey,{...current,...updated});
  };

  const toggleCheck=async(id)=>{
    const updated={...checks,[id]:!checks[id]};
    setChecks(updated);
    await saveDayData({checks:updated});
  };

  const saveMood=async(m)=>{
    setMood(m);
    await saveDayData({mood:m});
  };

  const saveJournal=async()=>{
    await saveDayData({journal:journalText});
    setJournalSaved(true);setTimeout(()=>setJournalSaved(false),1800);
  };

  const addWin=async()=>{
    if(!winText.trim())return;
    const updated=[{id:Date.now(),text:winText.trim(),date:todayStr()},...wins].slice(0,50);
    setWins(updated);await stSet("happiness-wins",updated);setWinText("");
  };

  const addHelp=async()=>{
    if(!helpText.trim())return;
    const updated=[{id:Date.now(),text:helpText.trim(),date:todayStr()},...helps].slice(0,50);
    setHelps(updated);await stSet("happiness-helps",updated);setHelpText("");
  };

  const checkedCount=Object.values(checks).filter(Boolean).length;
  const happinessScore=Math.round((checkedCount/HAPPINESS_PILLARS.length)*100);
  const scoreColor=happinessScore>=75?C.green:happinessScore>=50?C.gold:happinessScore>=25?C.saffron:C.muted;

  const MOODS=[
    {v:5,icon:"🤩",label:"Amazing"},
    {v:4,icon:"😊",label:"Good"},
    {v:3,icon:"😐",label:"Okay"},
    {v:2,icon:"😔",label:"Low"},
    {v:1,icon:"😞",label:"Rough"},
  ];

  return(
    <div>
      <SectionTitle icon="😊" title="Happiness System" sub="Joy is not found — it is built, daily, with intention."/>

      {/* SCORE + STREAK */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        <div style={{background:`${scoreColor}15`,border:`1px solid ${scoreColor}44`,borderRadius:14,padding:"14px 8px",textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:900,color:scoreColor}}>{happinessScore}%</div>
          <div style={{color:C.muted,fontSize:10,marginTop:2}}>Joy Score</div>
        </div>
        <div style={{background:`${C.pink}15`,border:`1px solid ${C.pink}44`,borderRadius:14,padding:"14px 8px",textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:900,color:C.pink}}>{checkedCount}/{HAPPINESS_PILLARS.length}</div>
          <div style={{color:C.muted,fontSize:10,marginTop:2}}>Pillars Done</div>
        </div>
        <div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}44`,borderRadius:14,padding:"14px 8px",textAlign:"center"}}>
          <div style={{fontSize:28,fontWeight:900,color:C.gold}}>{streak}d</div>
          <div style={{color:C.muted,fontSize:10,marginTop:2}}>Joy Streak</div>
        </div>
      </div>

      {/* SCORE BAR */}
      <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:20,overflow:"hidden"}}>
        <div style={{height:"100%",width:happinessScore+"%",background:`linear-gradient(90deg,${C.pink},${C.gold})`,borderRadius:4,transition:"width 0.5s"}}/>
      </div>

      {/* MOOD CHECK-IN */}
      <Card glow={C.pink}>
        <div style={{color:C.pink,fontWeight:800,fontSize:12,marginBottom:12,letterSpacing:1}}>🌡️ TODAY'S MOOD</div>
        <div style={{display:"flex",gap:6,justifyContent:"space-between"}}>
          {MOODS.map(m=>(
            <button key={m.v} onClick={()=>saveMood(m.v)}
              style={{flex:1,padding:"10px 4px",borderRadius:10,border:`2px solid ${mood===m.v?C.pink:C.border}`,
                background:mood===m.v?`${C.pink}22`:"transparent",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22}}>{m.icon}</div>
              <div style={{color:mood===m.v?C.pink:C.muted,fontSize:9,marginTop:3,fontWeight:700}}>{m.label}</div>
            </button>
          ))}
        </div>
        {mood&&(
          <div style={{marginTop:10,color:C.muted,fontSize:11,textAlign:"center"}}>
            {mood>=4?"You're in a great space today. Keep nurturing it. 🌟":
             mood===3?"A steady day. Small acts of joy can shift this.":
             "Low days are part of the journey. Be gentle with yourself. 🤍"}
          </div>
        )}
      </Card>

      {/* 8 HAPPINESS PILLARS */}
      <Card glow={C.gold}>
        <div style={{color:C.gold,fontWeight:800,fontSize:12,marginBottom:14,letterSpacing:1}}>✨ 8 HAPPINESS PILLARS — CHECK DAILY</div>
        {HAPPINESS_PILLARS.map((p,i)=>{
          const done=checks[p.id];
          const isOpen=activePillar===p.id;
          return(
            <div key={p.id} style={{marginBottom:8}}>
              <div onClick={()=>setActivePillar(isOpen?null:p.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                  borderRadius:10,cursor:"pointer",
                  background:done?`${p.color}15`:"rgba(255,255,255,0.03)",
                  border:`1px solid ${done?p.color+"44":C.border}`,
                  transition:"all 0.2s"}}>
                <div onClick={e=>{e.stopPropagation();toggleCheck(p.id);}}
                  style={{width:22,height:22,borderRadius:6,border:`2px solid ${done?p.color:C.border}`,
                    background:done?p.color:"transparent",flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
                  {done&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>✓</span>}
                </div>
                <span style={{fontSize:18,flexShrink:0}}>{p.icon}</span>
                <span style={{flex:1,color:done?p.color:C.text,fontWeight:done?800:600,fontSize:13,
                  textDecoration:done?"none":"none"}}>{p.label}</span>
                <span style={{color:C.muted,fontSize:11}}>{isOpen?"▲":"▼"}</span>
              </div>
              {isOpen&&(
                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:"0 0 10px 10px",padding:"10px 14px",
                  border:`1px solid ${p.color}22`,borderTop:"none",marginTop:-2}}>
                  <div style={{color:C.text,fontSize:12,lineHeight:1.7,marginBottom:8}}>{p.tip}</div>
                  <div style={{color:p.color,fontSize:11,fontStyle:"italic",borderLeft:`3px solid ${p.color}`,paddingLeft:8}}>"{p.quote}"</div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* CELEBRATE SMALL WINS */}
      <Card glow={C.saffron}>
        <div style={{color:C.saffron,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>🏆 CELEBRATE SMALL WINS</div>
        <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Write down one win — no matter how small. This rewires your brain to notice progress.</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={winText} onChange={e=>setWinText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&winText.trim())addWin();}}
            style={{...IS,flex:1}} placeholder="Today's win... e.g. Woke up at 3 AM ✓"/>
          <button onClick={addWin}
            style={{background:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#000",border:"none",
              borderRadius:8,padding:"9px 16px",fontWeight:900,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Add</button>
        </div>
        <div style={{maxHeight:180,overflowY:"auto"}}>
          {wins.filter(w=>w.date===todayStr()).length===0&&wins.length===0&&(
            <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No wins logged yet. Add your first one! 🌟</div>
          )}
          {wins.slice(0,15).map((w,i)=>(
            <div key={w.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.gold,fontSize:14,flexShrink:0}}>🏅</span>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:12}}>{w.text}</div>
                <div style={{color:C.muted,fontSize:10,marginTop:1}}>{w.date}</div>
              </div>
              <button onClick={async()=>{const u=wins.filter((_,j)=>j!==i);setWins(u);await stSet("happiness-wins",u);}}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,padding:"0 2px",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </Card>

      {/* HELP SOMEONE */}
      <Card glow={C.green}>
        <div style={{color:C.green,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>🌟 HELP SOMEONE TODAY</div>
        <div style={{color:C.muted,fontSize:11,marginBottom:10}}>One small act of service daily compounds into a life of meaning. Log it here.</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={helpText} onChange={e=>setHelpText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&helpText.trim())addHelp();}}
            style={{...IS,flex:1}} placeholder="Who did you help today and how?"/>
          <button onClick={addHelp}
            style={{background:C.green,color:"#fff",border:"none",borderRadius:8,
              padding:"9px 16px",fontWeight:900,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>+ Log</button>
        </div>
        <div style={{maxHeight:140,overflowY:"auto"}}>
          {helps.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No acts logged yet. Small or big — every act counts. 🌍</div>}
          {helps.slice(0,10).map((h,i)=>(
            <div key={h.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.green,fontSize:14,flexShrink:0}}>💚</span>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:12}}>{h.text}</div>
                <div style={{color:C.muted,fontSize:10,marginTop:1}}>{h.date}</div>
              </div>
              <button onClick={async()=>{const u=helps.filter((_,j)=>j!==i);setHelps(u);await stSet("happiness-helps",u);}}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,padding:"0 2px",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </Card>

      {/* HAPPINESS JOURNAL */}
      <Card glow={C.purple}>
        <div style={{color:C.purple,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>📝 HAPPINESS JOURNAL — Today</div>
        <div style={{color:C.muted,fontSize:11,marginBottom:8}}>What brought you joy today? What are you grateful for? Write freely.</div>
        <textarea value={journalText} onChange={e=>setJournalText(e.target.value)}
          style={{...IS,minHeight:90,resize:"vertical",lineHeight:1.7,marginBottom:8}}
          placeholder="3 things I'm grateful for today...\nOne moment that made me smile...\nSomething I'm looking forward to..."/>
        <button onClick={saveJournal}
          style={{background:journalSaved?C.green:`linear-gradient(135deg,${C.purple},${C.blue})`,color:"#fff",
            border:"none",borderRadius:8,padding:"9px 0",fontWeight:800,cursor:"pointer",fontSize:12,width:"100%"}}>
          {journalSaved?"✓ Saved!":"💾 Save Journal Entry"}
        </button>
      </Card>

      {/* HAPPINESS PHILOSOPHY */}
      <Card>
        <div style={{color:C.muted,fontWeight:800,fontSize:12,marginBottom:12,letterSpacing:1}}>🧠 HAPPINESS PHILOSOPHY</div>
        {[
          {icon:"😊",rule:"Smile is a discipline, not a reaction",detail:"Choose to smile first. Your mood will follow your face, not the other way around."},
          {icon:"🌱",rule:"Joy is not the absence of problems",detail:"It's the presence of meaning. Study, service, relationships — these give life weight and warmth."},
          {icon:"🎯",rule:"Discipline IS happiness",detail:"When you stick to your routine, you feel proud. Pride is a form of joy. Your ADO selection journey is your happiness journey."},
          {icon:"🤍",rule:"Protect your inner world",detail:"Guard your mind from comparison, news overload, and toxic energy. What you let in becomes what you feel."},
          {icon:"🙏",rule:"Gratitude before goals",detail:"Thank the universe for what you have before asking for what you want. Gratitude resets anxious energy instantly."},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
            <span style={{fontSize:18,flexShrink:0}}>{r.icon}</span>
            <div>
              <div style={{color:C.text,fontWeight:700,fontSize:12}}>{r.rule}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:2,lineHeight:1.5}}>{r.detail}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── MAHINDRA/FINANCE TAB ─────────────────────────────────────────────────────
function MahindraTab(){
  const{data,set,em}=useEC();
  const f=data.finance||{mahindraTarget:1500000,tradeInValue:80000,currentSaved:120000,jars:{daily:50,learning:200,fun:300,shizuka:300}};
  const targetNet=f.mahindraTarget-f.tradeInValue;
  const progressPct=Math.min(100,(f.currentSaved/targetNet)*100).toFixed(1);
  return(
    <div>
      <SectionTitle icon="🏎️" title="Mahindra Financial Engine" sub="Gamified tracking toward your dream."/>
      <Card glow={C.green}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16}}>
          <div><h3 style={{color:C.green,margin:"0 0 4px 0"}}>Mahindra Acquisition Goal</h3><div style={{color:C.muted,fontSize:12}}>Target: ₹{f.mahindraTarget.toLocaleString()} | Trade-In: -₹{f.tradeInValue.toLocaleString()}</div></div>
          <div style={{textAlign:"right"}}><div style={{color:C.text,fontSize:24,fontWeight:900}}>₹{f.currentSaved.toLocaleString()}</div><div style={{color:C.green,fontWeight:700}}>{progressPct}%</div></div>
        </div>
        <div style={{height:12,background:"rgba(255,255,255,0.06)",borderRadius:6,overflow:"hidden"}}>
          <div style={{height:"100%",width:progressPct+"%",background:`linear-gradient(90deg,${C.green},${C.teal})`,transition:"width 1s"}}/>
        </div>
        {em&&(
          <div style={{marginTop:16}}>
            <input type="number" placeholder="Add to savings..." onBlur={e=>{if(e.target.value)set("finance",{...f,currentSaved:f.currentSaved+Number(e.target.value)});e.target.value="";}} style={IS}/>
          </div>
        )}
      </Card>
      <Card>
        <h3 style={{color:C.gold,fontSize:13,marginBottom:16,textTransform:"uppercase",letterSpacing:1}}>Automated Micro-Jars</h3>
        {Object.entries(f.jars||{}).map(([key,val])=>(
          <div key={key} style={{display:"flex",alignItems:"center",marginBottom:16}}>
            <div style={{width:100,color:C.muted,textTransform:"capitalize",fontWeight:600,fontSize:13}}>{key} Jar</div>
            <input type="range" min="0" max="1000" step="10" value={val} onChange={e=>set("finance",{...f,jars:{...f.jars,[key]:Number(e.target.value)}})} style={{flex:1,marginRight:16,accentColor:C.gold}} disabled={!em}/>
            <div style={{width:60,color:C.gold,fontWeight:800,textAlign:"right"}}>₹{val}</div>
          </div>
        ))}
      </Card>
      {/* Also show Big Goals from money tab */}
      <Card glow={C.saffron}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:10}}>🎯 BIG LIFE GOALS</div>
        {(data.bigGoals||[]).map((g,i)=>(
          <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{color:C.text,fontWeight:700,fontSize:13}}>{g.goal}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>Target: {g.targetAmount} {g.deadline&&`| By: ${g.deadline}`}</div>
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
              <input type="range" min={0} max={100} value={g.progress||0} onChange={e=>set("bigGoals",(data.bigGoals||[]).map((x,j)=>j===i?{...x,progress:Number(e.target.value)}:x))} style={{flex:1,accentColor:C.saffron}}/>
              <span style={{color:C.saffron,fontWeight:700,fontSize:12,minWidth:32}}>{g.progress||0}%</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── MCQ ACCURACY TRACKER ────────────────────────────────────────────────────
function MCQTrackerTab(){
  const SUBJECTS=["Agriculture","Quant","Reasoning","English","Computer","Punjab GK","Current Affairs","General"];
  const [entries,setEntries]=useState([]);
  const [form,setForm]=useState({subject:"Agriculture",attempted:"",correct:"",weakTopics:"",date:todayStr()});
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      const saved=await stGet("mcq-tracker-entries");
      if(saved)setEntries(saved);
      setLoaded(true);
    })();
  },[]);

  const save=async(updated)=>{await stSet("mcq-tracker-entries",updated);};

  const addEntry=async()=>{
    const att=parseInt(form.attempted)||0;
    const cor=parseInt(form.correct)||0;
    if(!att)return;
    const wrong=att-cor;
    const accuracy=att>0?Math.round((cor/att)*100):0;
    const entry={id:Date.now(),subject:form.subject,attempted:att,correct:cor,wrong,accuracy,weakTopics:form.weakTopics,date:form.date||todayStr()};
    const updated=[entry,...entries];
    setEntries(updated);
    await save(updated);
    setForm({subject:form.subject,attempted:"",correct:"",weakTopics:"",date:todayStr()});
  };

  const removeEntry=async(id)=>{
    const updated=entries.filter(e=>e.id!==id);
    setEntries(updated);
    await save(updated);
  };

  // Running averages per subject
  const subjectAvg=SUBJECTS.map(s=>{
    const es=entries.filter(e=>e.subject===s);
    if(!es.length)return null;
    const avg=Math.round(es.reduce((a,e)=>a+e.accuracy,0)/es.length);
    const total=es.reduce((a,e)=>a+e.attempted,0);
    return{subject:s,avg,count:es.length,total};
  }).filter(Boolean);

  const overallAvg=entries.length?Math.round(entries.reduce((a,e)=>a+e.accuracy,0)/entries.length):0;

  // Bar chart data: last 7 entries
  const chartEntries=entries.slice(0,7).reverse();
  const maxAcc=100;

  return(
    <div>
      <SectionTitle icon="🎯" title="MCQ Accuracy Tracker" sub="Track accuracy per subject. Spot weak areas. Improve."/>

      {/* Overall accuracy */}
      {entries.length>0&&(
        <Card glow={overallAvg>=70?C.green:overallAvg>=40?C.gold:C.red} style={{textAlign:"center",padding:"20px 16px"}}>
          <div style={{color:C.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Overall Running Accuracy</div>
          <div style={{fontSize:56,fontWeight:900,color:overallAvg>=70?C.green:overallAvg>=40?C.gold:C.red}}>{overallAvg}%</div>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>{entries.length} sessions • {entries.reduce((a,e)=>a+e.attempted,0)} MCQs total</div>
        </Card>
      )}

      {/* Add entry form */}
      <Card glow={C.blue}>
        <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:12}}>➕ Log MCQ Session</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Subject</div>
            <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} style={{...IS,background:"#111122"}}>
              {SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Date</div>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={IS}/>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Attempted</div>
            <input type="number" value={form.attempted} onChange={e=>setForm({...form,attempted:e.target.value})} style={IS} placeholder="e.g. 50"/>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Correct</div>
            <input type="number" value={form.correct} onChange={e=>setForm({...form,correct:e.target.value})} style={IS} placeholder="e.g. 38"/>
          </div>
        </div>
        {form.attempted&&form.correct&&(
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",gap:16}}>
            <span style={{color:C.green,fontSize:13,fontWeight:700}}>✓ {form.correct}</span>
            <span style={{color:C.red,fontSize:13,fontWeight:700}}>✗ {parseInt(form.attempted||0)-parseInt(form.correct||0)}</span>
            <span style={{color:C.gold,fontSize:13,fontWeight:700}}>{form.attempted>0?Math.round((form.correct/form.attempted)*100):0}%</span>
          </div>
        )}
        <div style={{marginBottom:10}}>
          <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Weak Topics (optional)</div>
          <input value={form.weakTopics} onChange={e=>setForm({...form,weakTopics:e.target.value})} style={IS} placeholder="e.g. Percentage, Ratio..."/>
        </div>
        <button onClick={addEntry} style={{width:"100%",background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",border:"none",borderRadius:10,padding:"12px 0",fontWeight:800,fontSize:13,cursor:"pointer"}}>
          + Add Entry
        </button>
      </Card>

      {/* Subject averages */}
      {subjectAvg.length>0&&(
        <Card glow={C.gold}>
          <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>📊 Subject-wise Averages</div>
          {subjectAvg.map(s=>(
            <div key={s.subject} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:C.text,fontSize:12,fontWeight:600}}>{s.subject}</span>
                <span style={{color:s.avg>=70?C.green:s.avg>=40?C.gold:C.red,fontWeight:800,fontSize:12}}>{s.avg}% avg ({s.count} sessions)</span>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:s.avg+"%",background:s.avg>=70?C.green:s.avg>=40?C.gold:C.red,transition:"width 0.5s",borderRadius:3}}/>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Recent entries chart */}
      {chartEntries.length>0&&(
        <Card glow={C.purple}>
          <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:12}}>📈 Last {chartEntries.length} Sessions</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,marginBottom:8}}>
            {chartEntries.map((e,i)=>{
              const col=e.accuracy>=70?C.green:e.accuracy>=40?C.gold:C.red;
              return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{color:col,fontSize:9,fontWeight:700}}>{e.accuracy}%</div>
                  <div style={{width:"100%",height:(e.accuracy/maxAcc*75+5)+"%",background:col,borderRadius:"3px 3px 0 0",minHeight:3}}/>
                  <div style={{color:C.muted,fontSize:8,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",maxWidth:"100%"}}>{e.subject.slice(0,4)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Entry list */}
      <div>
        {!loaded&&<Card><div style={{color:C.muted,textAlign:"center"}}>Loading...</div></Card>}
        {loaded&&entries.length===0&&<Card><div style={{color:C.muted,textAlign:"center"}}>No entries yet. Log your first MCQ session above!</div></Card>}
        {entries.map(e=>(
          <Card key={e.id} style={{padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <span style={{color:C.gold,fontWeight:800,fontSize:13}}>{e.subject}</span>
                  <span style={{color:C.muted,fontSize:11}}>• {e.date}</span>
                </div>
                <div style={{display:"flex",gap:12}}>
                  <span style={{color:C.text,fontSize:12}}>📝 {e.attempted} Qs</span>
                  <span style={{color:C.green,fontSize:12}}>✓ {e.correct}</span>
                  <span style={{color:C.red,fontSize:12}}>✗ {e.wrong}</span>
                  <span style={{color:e.accuracy>=70?C.green:e.accuracy>=40?C.gold:C.red,fontWeight:800,fontSize:13}}>{e.accuracy}%</span>
                </div>
                {e.weakTopics&&<div style={{color:C.muted,fontSize:11,marginTop:4}}>⚠️ Weak: {e.weakTopics}</div>}
              </div>
              <button onClick={()=>removeEntry(e.id)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,cursor:"pointer",borderRadius:6,padding:"4px 8px",fontSize:11,flexShrink:0}}>✕</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MISTAKE BOOK ─────────────────────────────────────────────────────────────
function MistakeBookTab(){
  const SUBJECTS=["Agriculture","Quant","Reasoning","English","Computer","Punjab GK","Current Affairs","General"];
  const STATUSES=["Pending Review","Reviewed","Mastered"];
  const [entries,setEntries]=useState([]);
  const [form,setForm]=useState({subject:"Agriculture",topic:"",question:"",wrongAnswer:"",correctAnswer:"",lesson:"",status:"Pending Review"});
  const [showForm,setShowForm]=useState(false);
  const [search,setSearch]=useState("");
  const [filterSubject,setFilterSubject]=useState("All");
  const [filterStatus,setFilterStatus]=useState("All");
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      const saved=await stGet("mistake-book-entries");
      if(saved)setEntries(saved);
      setLoaded(true);
    })();
  },[]);

  const saveAll=async(updated)=>{await stSet("mistake-book-entries",updated);};

  const addEntry=async()=>{
    if(!form.question.trim())return;
    const entry={id:Date.now(),...form,date:todayStr()};
    const updated=[entry,...entries];
    setEntries(updated);
    await saveAll(updated);
    setForm({subject:form.subject,topic:"",question:"",wrongAnswer:"",correctAnswer:"",lesson:"",status:"Pending Review"});
    setShowForm(false);
  };

  const updateStatus=async(id,status)=>{
    const updated=entries.map(e=>e.id===id?{...e,status}:e);
    setEntries(updated);
    await saveAll(updated);
  };

  const removeEntry=async(id)=>{
    const updated=entries.filter(e=>e.id!==id);
    setEntries(updated);
    await saveAll(updated);
  };

  const filtered=entries.filter(e=>{
    const matchSearch=!search||e.question.toLowerCase().includes(search.toLowerCase())||e.topic.toLowerCase().includes(search.toLowerCase())||e.lesson.toLowerCase().includes(search.toLowerCase());
    const matchSubject=filterSubject==="All"||e.subject===filterSubject;
    const matchStatus=filterStatus==="All"||e.status===filterStatus;
    return matchSearch&&matchSubject&&matchStatus;
  });

  const statusColor={Mastered:C.green,"Reviewed":C.blue,"Pending Review":C.red};

  return(
    <div>
      <SectionTitle icon="📖" title="Mistake Book" sub="Same mistake twice = biggest score leak. Log it. Fix it. Seal it."/>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {STATUSES.map(s=>{
          const cnt=entries.filter(e=>e.status===s).length;
          return(
            <div key={s} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${statusColor[s]}33`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:900,color:statusColor[s]}}>{cnt}</div>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{s}</div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter */}
      <Card>
        <input value={search} onChange={e=>setSearch(e.target.value)} style={{...IS,marginBottom:8}} placeholder="🔍 Search questions, topics, lessons..."/>
        <div style={{display:"flex",gap:8}}>
          <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} style={{...IS,flex:1,background:"#111122"}}>
            <option>All</option>
            {SUBJECTS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...IS,flex:1,background:"#111122"}}>
            <option>All</option>
            {STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {/* Add entry toggle */}
      <button onClick={()=>setShowForm(!showForm)} style={{width:"100%",background:showForm?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${C.red},${C.saffron})`,color:showForm?C.muted:"#000",border:"none",borderRadius:12,padding:"12px 0",fontWeight:800,fontSize:13,cursor:"pointer",marginBottom:12}}>
        {showForm?"✕ Cancel":"+ Add Mistake"}
      </button>

      {/* Add form */}
      {showForm&&(
        <Card glow={C.red}>
          <div style={{color:C.red,fontWeight:800,fontSize:13,marginBottom:12}}>📝 New Mistake Entry</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Subject</div>
              <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} style={{...IS,background:"#111122"}}>
                {SUBJECTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Topic</div>
              <input value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} style={IS} placeholder="e.g. Percentage"/>
            </div>
          </div>
          {[
            {k:"question",l:"Question",ph:"Write the question..."},
            {k:"wrongAnswer",l:"My Wrong Answer",ph:"What I chose..."},
            {k:"correctAnswer",l:"Correct Answer",ph:"The right answer is..."},
            {k:"lesson",l:"Lesson / Why I Was Wrong",ph:"The concept I missed..."},
          ].map(f=>(
            <div key={f.k} style={{marginBottom:10}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{f.l}</div>
              <textarea value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} style={{...IS,minHeight:60,resize:"vertical"}} placeholder={f.ph}/>
            </div>
          ))}
          <button onClick={addEntry} style={{width:"100%",background:`linear-gradient(135deg,${C.red},${C.saffron})`,color:"#000",border:"none",borderRadius:10,padding:"12px 0",fontWeight:800,fontSize:13,cursor:"pointer"}}>
            Save Mistake
          </button>
        </Card>
      )}

      {/* Entries */}
      {!loaded&&<Card><div style={{color:C.muted,textAlign:"center"}}>Loading...</div></Card>}
      {loaded&&filtered.length===0&&<Card><div style={{color:C.muted,textAlign:"center"}}>No mistakes found. {entries.length===0?"Log your first mistake above!":"Try changing filters."}</div></Card>}
      {filtered.map(e=>(
        <Card key={e.id} style={{borderLeft:`3px solid ${statusColor[e.status]}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{color:C.gold,fontWeight:800,fontSize:12}}>{e.subject}</span>
                {e.topic&&<span style={{color:C.muted,fontSize:11}}>• {e.topic}</span>}
                <span style={{color:C.muted,fontSize:11}}>• {e.date}</span>
              </div>
            </div>
            <button onClick={()=>removeEntry(e.id)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,cursor:"pointer",borderRadius:6,padding:"3px 7px",fontSize:11}}>✕</button>
          </div>
          <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:8,lineHeight:1.5}}>❓ {e.question}</div>
          <div style={{background:"rgba(239,68,68,0.08)",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
            <div style={{color:C.red,fontSize:11,fontWeight:700,marginBottom:2}}>✗ Wrong: {e.wrongAnswer}</div>
          </div>
          <div style={{background:"rgba(16,185,129,0.08)",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
            <div style={{color:C.green,fontSize:11,fontWeight:700,marginBottom:2}}>✓ Correct: {e.correctAnswer}</div>
          </div>
          {e.lesson&&<div style={{color:C.teal,fontSize:12,fontStyle:"italic",marginBottom:10}}>💡 {e.lesson}</div>}
          {/* Status selector */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {STATUSES.map(s=>(
              <button key={s} onClick={()=>updateStatus(e.id,s)}
                style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${statusColor[s]}`,background:e.status===s?statusColor[s]:"transparent",color:e.status===s?"#000":statusColor[s],fontSize:10,fontWeight:700,cursor:"pointer"}}>
                {s}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── PYQ TRACKER ─────────────────────────────────────────────────────────────
function PYQTrackerTab(){
  const SUBJECTS=["Agriculture","Quant","Reasoning","English","Computer","Punjab GK","Current Affairs"];
  const YEARS=["2024","2023","2022","2021","2020","2019","2018","2017"];
  const [pyqs,setPyqs]=useState({});
  const [loaded,setLoaded]=useState(false);
  const [activeTab,setActiveTab]=useState("subject");
  const [expandedSubject,setExpandedSubject]=useState(null);

  useEffect(()=>{
    (async()=>{
      const saved=await stGet("pyq-tracker-data");
      if(saved)setPyqs(saved);
      setLoaded(true);
    })();
  },[]);

  const toggle=async(subject,year)=>{
    const key=subject+"-"+year;
    const updated={...pyqs,[key]:!pyqs[key]};
    setPyqs(updated);
    await stSet("pyq-tracker-data",updated);
  };

  const subjectStats=SUBJECTS.map(s=>{
    const total=YEARS.length;
    const done=YEARS.filter(y=>pyqs[s+"-"+y]).length;
    return{subject:s,done,total,pct:Math.round((done/total)*100)};
  });

  const yearStats=YEARS.map(yr=>{
    const total=SUBJECTS.length;
    const done=SUBJECTS.filter(s=>pyqs[s+"-"+yr]).length;
    return{year:yr,done,total,pct:Math.round((done/total)*100)};
  });

  const totalDone=Object.values(pyqs).filter(Boolean).length;
  const totalPossible=SUBJECTS.length*YEARS.length;
  const overallPct=Math.round((totalDone/totalPossible)*100);

  return(
    <div>
      <SectionTitle icon="📜" title="PYQ Tracker" sub="Previous Year Questions — Subject-wise & Year-wise. Know your coverage."/>

      {/* Overall progress */}
      <Card glow={C.purple} style={{textAlign:"center",padding:"18px 16px"}}>
        <div style={{color:C.muted,fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Overall PYQ Coverage</div>
        <div style={{fontSize:48,fontWeight:900,color:C.purple}}>{overallPct}%</div>
        <div style={{height:8,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden",maxWidth:260,margin:"10px auto 4px"}}>
          <div style={{height:"100%",width:overallPct+"%",background:`linear-gradient(90deg,${C.purple},${C.blue})`,transition:"width 0.5s",borderRadius:4}}/>
        </div>
        <div style={{color:C.muted,fontSize:12}}>{totalDone} / {totalPossible} papers done</div>
      </Card>

      {/* View toggle */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[{id:"subject",l:"📚 By Subject"},{id:"year",l:"📅 By Year"},{id:"grid",l:"📋 Full Grid"}].map(v=>(
          <button key={v.id} onClick={()=>setActiveTab(v.id)}
            style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",background:activeTab===v.id?C.purple:"rgba(255,255,255,0.06)",color:activeTab===v.id?"#fff":"#aaa",fontWeight:800,cursor:"pointer",fontSize:11}}>
            {v.l}
          </button>
        ))}
      </div>

      {/* Subject view */}
      {activeTab==="subject"&&(
        <div>
          {subjectStats.map(s=>(
            <Card key={s.subject}>
              <div onClick={()=>setExpandedSubject(expandedSubject===s.subject?null:s.subject)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{color:C.text,fontWeight:700,fontSize:13}}>{s.subject}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:s.pct>=70?C.green:s.pct>=40?C.gold:C.red,fontWeight:800,fontSize:13}}>{s.done}/{s.total}</span>
                    <span style={{color:C.muted,fontSize:11}}>({s.pct}%)</span>
                    <span style={{color:C.muted,fontSize:12}}>{expandedSubject===s.subject?"▲":"▼"}</span>
                  </div>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:s.pct+"%",background:s.pct>=70?C.green:s.pct>=40?C.gold:C.red,transition:"width 0.5s",borderRadius:3}}/>
                </div>
              </div>
              {expandedSubject===s.subject&&(
                <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
                  {YEARS.map(yr=>{
                    const done=pyqs[s.subject+"-"+yr];
                    return(
                      <button key={yr} onClick={()=>toggle(s.subject,yr)}
                        style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${done?C.green:C.border}`,background:done?C.green+"22":"transparent",color:done?C.green:C.muted,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        {done?"✓":""} {yr}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Year view */}
      {activeTab==="year"&&(
        <div>
          {yearStats.map(y=>(
            <Card key={y.year}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:C.gold,fontWeight:800,fontSize:14}}>📅 {y.year}</span>
                <span style={{color:y.pct>=70?C.green:y.pct>=40?C.gold:C.red,fontWeight:800,fontSize:13}}>{y.done}/{y.total} ({y.pct}%)</span>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",width:y.pct+"%",background:y.pct>=70?C.green:y.pct>=40?C.gold:C.red,transition:"width 0.5s",borderRadius:3}}/>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SUBJECTS.map(s=>{
                  const done=pyqs[s+"-"+y.year];
                  return(
                    <button key={s} onClick={()=>toggle(s,y.year)}
                      style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${done?C.green:C.border}`,background:done?C.green+"22":"transparent",color:done?C.green:C.muted,fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {done?"✓ ":""}{s}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Full grid */}
      {activeTab==="grid"&&(
        <Card>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr>
                  <th style={{padding:"8px 6px",color:C.muted,textAlign:"left",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>Subject</th>
                  {YEARS.map(y=><th key={y} style={{padding:"8px 6px",color:C.muted,textAlign:"center",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map(s=>(
                  <tr key={s} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"8px 6px",color:C.text,fontWeight:600,whiteSpace:"nowrap"}}>{s}</td>
                    {YEARS.map(yr=>{
                      const done=pyqs[s+"-"+yr];
                      return(
                        <td key={yr} style={{padding:"6px",textAlign:"center"}}>
                          <button onClick={()=>toggle(s,yr)}
                            style={{width:28,height:28,borderRadius:6,border:`1px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",color:done?"#000":"transparent",fontSize:12,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
                            {done?"✓":""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── HABIT HEATMAP ────────────────────────────────────────────────────────────
function HabitHeatmapTab(){
  const HABITS=[
    {id:"study",label:"📚 Study",color:C.green},
    {id:"meditation",label:"🧘 Meditation",color:C.purple},
    {id:"exercise",label:"💪 Exercise",color:C.saffron},
    {id:"mcqs",label:"🎯 MCQs",color:C.gold},
    {id:"anki",label:"🎴 Anki",color:C.blue},
    {id:"reading",label:"📖 Geeta",color:C.teal},
    {id:"sleep",label:"💤 Sleep 9:30",color:C.pink},
    {id:"water",label:"💧 Water 3L",color:"#60A5FA"},
  ];

  const [habitData,setHabitData]=useState({});
  const [selectedHabit,setSelectedHabit]=useState("study");
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      const saved=await stGet("habit-heatmap-data");
      if(saved)setHabitData(saved);
      setLoaded(true);
    })();
  },[]);

  const toggleDay=async(habitId,dateStr)=>{
    const key=habitId+"-"+dateStr;
    const updated={...habitData,[key]:!habitData[key]};
    setHabitData(updated);
    await stSet("habit-heatmap-data",updated);
  };

  // Generate last 112 days (16 weeks) for heatmap
  const genDays=(n=112)=>{
    const days=[];
    const today=new Date();
    for(let i=n-1;i>=0;i--){
      const d=new Date(today);
      d.setDate(today.getDate()-i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  };
  const allDays=genDays(112);
  const today=todayStr();

  // Stats for selected habit
  const habitDays=allDays.filter(d=>habitData[selectedHabit+"-"+d]);
  const currentStreak=(()=>{
    let streak=0;
    const d=new Date();
    while(true){
      const ds=d.toISOString().slice(0,10);
      if(habitData[selectedHabit+"-"+ds])streak++;
      else break;
      d.setDate(d.getDate()-1);
    }
    return streak;
  })();
  const bestStreak=(()=>{
    let best=0,cur=0;
    for(const d of allDays){
      if(habitData[selectedHabit+"-"+d])cur++;
      else cur=0;
      if(cur>best)best=cur;
    }
    return best;
  })();
  const missedDays=allDays.length-habitDays.length;
  const completionPct=Math.round((habitDays.length/allDays.length)*100);

  // Group days into weeks for the grid
  const weeks=[];
  for(let i=0;i<allDays.length;i+=7){weeks.push(allDays.slice(i,i+7));}

  const habit=HABITS.find(h=>h.id===selectedHabit)||HABITS[0];
  const habitColor=habit.color;

  // Today's checklist across all habits
  const todayCompletion=HABITS.filter(h=>habitData[h.id+"-"+today]).length;

  return(
    <div>
      <SectionTitle icon="🔥" title="Habit Heatmap" sub="GitHub-style habit tracking. Build your streak. Don't break the chain."/>

      {/* Today's completion */}
      <Card glow={C.green} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:C.green,fontWeight:800,fontSize:13}}>✅ Today — {today}</div>
          <div style={{color:C.green,fontWeight:900,fontSize:16}}>{todayCompletion}/{HABITS.length}</div>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden",marginBottom:12}}>
          <div style={{height:"100%",width:(todayCompletion/HABITS.length*100)+"%",background:`linear-gradient(90deg,${C.green},${C.teal})`,borderRadius:3,transition:"width 0.4s"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {HABITS.map(h=>{
            const done=habitData[h.id+"-"+today];
            return(
              <div key={h.id} onClick={()=>toggleDay(h.id,today)}
                style={{display:"flex",gap:8,alignItems:"center",padding:"8px 10px",borderRadius:10,cursor:"pointer",background:done?h.color+"18":"rgba(255,255,255,0.03)",border:`1px solid ${done?h.color+"44":C.border}`}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${done?h.color:C.border}`,background:done?h.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {done&&<span style={{color:"#000",fontSize:10,fontWeight:900}}>✓</span>}
                </div>
                <span style={{color:done?h.color:C.muted,fontSize:11,fontWeight:600}}>{h.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Habit selector */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
        {HABITS.map(h=>(
          <button key={h.id} onClick={()=>setSelectedHabit(h.id)}
            style={{padding:"7px 12px",borderRadius:20,border:`1px solid ${selectedHabit===h.id?h.color:C.border}`,background:selectedHabit===h.id?h.color+"22":"transparent",color:selectedHabit===h.id?h.color:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            {h.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {[
          {l:"Current Streak",v:currentStreak+"d",c:habitColor},
          {l:"Best Streak",v:bestStreak+"d",c:C.gold},
          {l:"Completion",v:completionPct+"%",c:completionPct>=70?C.green:C.saffron},
          {l:"Missed Days",v:missedDays,c:missedDays>14?C.red:C.muted},
        ].map((s,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${s.c}33`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{color:s.c,fontWeight:900,fontSize:18}}>{s.v}</div>
            <div style={{color:C.muted,fontSize:9,marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <Card glow={habitColor}>
        <div style={{color:habitColor,fontWeight:800,fontSize:13,marginBottom:12}}>{habit.label} — Last 16 Weeks</div>
        <div style={{display:"flex",gap:3,overflowX:"auto",paddingBottom:4}}>
          {weeks.map((week,wi)=>(
            <div key={wi} style={{display:"flex",flexDirection:"column",gap:3}}>
              {week.map(dayStr=>{
                const done=habitData[selectedHabit+"-"+dayStr];
                const isToday=dayStr===today;
                return(
                  <div key={dayStr} onClick={()=>toggleDay(selectedHabit,dayStr)}
                    title={dayStr}
                    style={{
                      width:14,height:14,borderRadius:3,cursor:"pointer",flexShrink:0,
                      background:done?habitColor:"rgba(255,255,255,0.06)",
                      border:isToday?`1px solid ${habitColor}`:"1px solid transparent",
                      opacity:done?1:0.7,
                      transition:"background 0.2s",
                    }}/>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
          <div style={{width:12,height:12,borderRadius:2,background:"rgba(255,255,255,0.06)"}}/>
          <span style={{color:C.muted,fontSize:10}}>Missed</span>
          <div style={{width:12,height:12,borderRadius:2,background:habitColor}}/>
          <span style={{color:C.muted,fontSize:10}}>Done</span>
        </div>
      </Card>

      {/* Monthly streak chart */}
      <Card glow={C.gold}>
        <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>📅 Monthly Completion</div>
        {(()=>{
          const months={};
          for(const d of allDays){
            const m=d.slice(0,7);
            if(!months[m])months[m]={total:0,done:0};
            months[m].total++;
            if(habitData[selectedHabit+"-"+d])months[m].done++;
          }
          const mKeys=Object.keys(months).sort();
          return(
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
              {mKeys.map(m=>{
                const pct=months[m].total>0?Math.round(months[m].done/months[m].total*100):0;
                const col=pct>=70?C.green:pct>=40?C.gold:C.red;
                return(
                  <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{color:col,fontSize:9,fontWeight:700}}>{pct}%</div>
                    <div style={{width:"100%",height:(pct*0.7+5)+"%",background:col,borderRadius:"3px 3px 0 0",minHeight:4}}/>
                    <div style={{color:C.muted,fontSize:8}}>{m.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}


// ─── LIVE DYNAMIC PDF EXPORT ENGINE v2.0 ─────────────────────────────────────
// MISSION: Every export reads live data, auto-detects all modules, never uses
// hard-coded pages. Future modules appear automatically with zero code changes.

// Dynamic module registry — auto-built from TAB_GROUPS at runtime.
// EXPORT_TABS kept for backwards compat with StorageTab/buildFullExportHtml.
const EXPORT_TABS = TAB_GROUPS.flatMap(g => g.tabs.map(t => ({
  id: t.id,
  label: t.icon + " " + t.label,
  group: g.label,
  groupColor: g.color,
})));

// ─── LIVE DYNAMIC PDF EXPORT ENGINE v2.0 — Content Builders ─────────────────

// ── Smart content extractor: reads any data field and renders it readably ──
function autoRenderValue(val, depth){
  if(depth === undefined) depth = 0;
  if(val === null || val === undefined) return "";
  if(typeof val === "boolean") return val ? "✅ Yes" : "❌ No";
  if(typeof val === "number") return String(val);
  if(typeof val === "string") return val || "—";
  if(Array.isArray(val)){
    if(val.length === 0) return "—";
    // Array of primitives → bullet list
    if(typeof val[0] !== "object") return val.map(i=>`• ${i}`).join("<br/>");
    // Array of objects → render each item
    return val.map(item => {
      const text = item.label||item.title||item.goal||item.item||item.hack||item.rule
        ||item.tip||item.step||item.method||item.subject||item.day||item.time
        ||item.name||item.activity||item.jar||item.trigger||item.meal||item.sit
        ||item.sit||item.mod||item.thug||item.icon||"";
      const detail = item.detail||item.why||item.use||item.note||item.notes
        ||item.plan||item.rule||item.sub||item.food||item.done!=null?(item.done?"✅":"⬜"):""
        ||"";
      const extra = item.pct!=null?` (${item.pct}%)`:"";
      const prefix = item.icon?item.icon+" ":"";
      if(text || detail){
        return `<span style="font-weight:700">${prefix}${text}${extra}</span>${detail?" — "+detail:""}`;
      }
      return depth<2 ? autoRenderValue(item, depth+1) : JSON.stringify(item);
    }).join("<br/>");
  }
  if(typeof val === "object"){
    return Object.entries(val)
      .filter(([k])=>!k.startsWith("_"))
      .map(([k,v])=>`<b>${k}</b>: ${autoRenderValue(v, depth+1)}`)
      .join("<br/>");
  }
  return String(val);
}

// ── Known-field renderers for the most important tabs (rich layout) ──────────
const RICH_RENDERERS = {
  identity: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.title||i.goal||i.item||i.hack||i.rule||i.tip||JSON.stringify(i))}`).join("<br/>");
    return [
      card("🔥 Identity Statement",`<pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;">${d.identityStatement||""}</pre>`),
      card("🌅 Morning Affirmation", d.morningAffirmation||""),
      card("🌙 Evening Affirmation", d.eveningAffirmation||""),
      card("👑 Priority Order", list(d.priorities)),
      card("💎 Philosophy Codes", list(d.philosophyCodes)),
      card("🧠 Mindset Rules", (d.mindsetRules||[]).map(r=>`<b>${r.icon||""} ${r.title||""}</b>: ${r.detail||""}`).join("<br/>")),
      card("🧲 Self-Control Rules", (d.selfControlRules||[]).map(r=>`<b>${r.icon||""} ${r.title||""}</b>: ${r.detail||""}`).join("<br/>")),
      card("🌙 Golden Questions", list(d.goldenQuestions)),
      card("🛟 Backup Plans", (d.backupPlans||[]).map(b=>`⚠️ <b>${b.trigger||""}</b> → ${b.plan||""}`).join("<br/>")),
    ].join("");
  },
  schedule: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return [
      card("⏰ Daily Time Blocks", (d.schedule||[]).map(s=>`<b style="color:#FF6B35">${s.time}</b> — <b>${s.activity}</b>: ${s.detail}`).join("<br/>")),
      card("📊 Subject Allocation", (d.subjectAlloc||[]).map(s=>`<b>${s.label}</b>: ${s.time} — ${s.note}`).join("<br/>")),
    ].join("");
  },
  study: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.title||i.goal||i.item||i.hack||i.rule||i.tip||JSON.stringify(i))}`).join("<br/>");
    return [
      card("🧘 Pre-Study Ritual", list(d.preStudyRitual)),
      card("📚 14-Step Framework", (d.studyFramework||[]).map((s,i)=>`${i+1}. ${s}`).join(" → ")),
      card("🏁 Exam Final Phase", (d.examFinalPhase||[]).map(e=>`<b>${e.rule}</b>: ${e.detail}`).join("<br/>")),
      card("🌾 AFO Prelims", list(d.afoPrelims)),
      card("🌾 AFO Mains", list(d.afoMains)),
      card("✅ Agri Checklist", list(d.agriChecklist)),
      card("🧠 Memory Methods", (d.memoryMethods||[]).map(m=>`<b>${m.method}</b>: ${m.use}`).join("<br/>")),
      card("💡 Study Hacks", (d.studyHacks||[]).map(h=>`→ <b>${h.hack}</b>: ${h.detail}`).join("<br/>")),
      card("🎴 Anki Rules", (d.ankiRules||[]).map(r=>`<b>${r.rule}</b>: ${r.detail}`).join("<br/>")),
    ].join("");
  },
  health: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.title||i.goal||i.item||JSON.stringify(i))}`).join("<br/>");
    return [
      card("🍽️ Diet Plan", (d.diet||[]).map(m=>`${m.icon||""} <b>${m.meal}</b>: ${m.food}`).join("<br/>")),
      card("💪 Health Habits", list(d.healthHabits)),
      card("🪑 Posture Rules", (d.posture||[]).map(p=>`<b>${p.sit}</b>: ${p.rule}`).join("<br/>")),
      card("🌸 Vitality & Health", (d.sexHealth||[]).map(s=>`<b>${s.item}</b>: ${s.detail}`).join("<br/>")),
    ].join("");
  },
  money: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return [
      card("🫙 Jar System", (d.moneyJars||[]).map(j=>`<b>${j.jar}</b>: ${j.amount} — ${j.rule}`).join("<br/>")),
      card("🎯 Big Goals", (d.bigGoals||[]).map(g=>`<b>${g.goal}</b> | ${g.targetAmount} | ${g.progress||0}%`).join("<br/>")),
    ].join("");
  },
  progress: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return [
      card("📚 Subject Progress", (d.subjectProgress||[]).map(s=>`<b>${s.subject}</b>: ${s.pct}% — Weak: ${s.weakTopics||"—"}`).join("<br/>")),
      card("🏆 Milestones", (d.milestones||[]).map(m=>`${m.done?"✅":"⬜"} ${m.label}`).join("<br/>")),
      card("🎯 Revision Targets", (d.revisionTargets||[]).map(r=>`<b>${r.subject}</b>: ${r.target||"—"}`).join("<br/>")),
      card("📝 Strength & Weakness", d.strengthWeakNote||"—"),
    ].join("");
  },
  checklist: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.item||JSON.stringify(i))}`).join("<br/>");
    return [
      card("📋 Daily Checklist", list(d.checklistItems)),
      card("🥇 Topper's Edge", (d.topperEdge||[]).map(t=>`<b>${t.item}</b> — ${t.why}`).join("<br/>")),
    ].join("");
  },
  masterplan: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return (d.studyMatrix||[]).map(subj=>{
      const tot=subj.subTopics.reduce((a,t)=>a+Number(t.targetHrs),0);
      const act=subj.subTopics.reduce((a,t)=>a+Number(t.actualHrs),0);
      return card(`${subj.subject} (${act}/${tot}h)`, subj.subTopics.map(t=>`<b>${t.name}</b>: ${t.actualHrs}/${t.targetHrs}h — ${t.notes}`).join("<br/>"));
    }).join("");
  },
  digital: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.item||JSON.stringify(i))}`).join("<br/>");
    return [
      card("🛠️ Tools", (d.digitalTools||[]).map(t=>`<b>${t.tool}</b>: ${t.purpose}`).join("<br/>")),
      card("🚫 Digital Rules", list(d.digitalRules)),
      card("🎥 YouTube 7-Day", (d.youtubeWeek||[]).map(y=>`<b>${y.day}</b>: ${y.task}`).join(" → ")),
    ].join("");
  },
  selfctrl: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return [
      card("🧠 Frontal Lobe Science","Phone + reels = frontal lobe weakens = self-control drops. Phone duur = stronger willpower."),
      card("🏛️ 4 Rules of Self-Control", (SELF_CONTROL_RULES||[]).map((r,i)=>`<b>${i+1}. ${r.title}</b>: ${r.detail}`).join("<br/>")),
    ].join("");
  },
  vitality: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.item||JSON.stringify(i))}`).join("<br/>");
    return [
      card("⚡ Vitality Meals", list(d.vitalityMeals)),
      card("🧘 Knorr Pre-Mock","Boil 2 cups water + Knorr soup base + black pepper. Light, warm, sharp fuel for mock tests."),
      card("💧 Sujata Vitality Juice","1 apple + 1 amla + ginger + turmeric + 250ml water. 30 min before morning study."),
    ].join("");
  },
  flow: ()=>{
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return card("🧘 Flow State Tips","Yoga Nidra: 90 min recovery. Surya Nadi before tasks. Ida Nadi before sleep. Breathing: Belly → Ribs → Chest (4s in, 4s out).");
  },
  content: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return card("📆 Content Schedule", (d.contentSchedule||[]).map(r=>`<b>${r.day}</b>: YT ${r.ytHours||"—"}h "${r.ytTopic||"—"}" | FB ${r.fbHours||"—"}h "${r.fbTopic||"—"}"`).join("<br/>"));
  },
  ideas: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return card("💡 Ideas", (d.ideas||[]).map(i=>`${i.done?"✅":"⬜"} ${i.text} (${i.date})`).join("<br/>"));
  },
  metrics: ()=>{
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return card("📐 Key Metrics","Daily: study hours, MCQs, Anki. Weekly: mock score, coverage. Monthly: syllabus %, mock trend, habit rating.");
  },
  finance: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    return [
      card("🏎️ Mahindra Goal",`Target: ₹${(d.finance?.mahindraTarget||0).toLocaleString()} | Trade-in: ₹${(d.finance?.tradeInValue||0).toLocaleString()} | Saved: ₹${(d.finance?.currentSaved||0).toLocaleString()}`),
      card("🫙 Micro-Jars", Object.entries(d.finance?.jars||{}).map(([k,v])=>`<b>${k}</b>: ₹${v}/day`).join(" | ")),
    ].join("");
  },
  community: d => {
    const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;
    const list=arr=>(arr||[]).map(i=>`• ${typeof i==="string"?i:(i.label||i.item||JSON.stringify(i))}`).join("<br/>");
    return [
      card("🗺️ Circuit", list(d.community?.circuit)),
      card("📜 Sarpanch Script", d.community?.sarpanchScript||""),
      card("🎥 YT Pipeline", (d.community?.youtubePipeline||[]).map(p=>`<b>${p.day} ${p.stage}</b>: ${p.task}`).join("<br/>")),
    ].join("");
  },
};

// ── Universal fallback: auto-render any tab's data dynamically ───────────────
function buildTabTextContent(tid, d) {
  // Use rich renderer if available
  if(RICH_RENDERERS[tid]) return RICH_RENDERERS[tid](d);

  // DYNAMIC FALLBACK: scan data for fields related to this tab
  const card=(t,b)=>`<div class="pdf-card"><div class="pdf-label">${t}</div><div class="pdf-value">${b||"—"}</div></div>`;

  // Try common data keys that might match this tab
  const guesses = [
    tid, tid+"s", tid+"Data", tid+"Items", tid+"List",
    tid+"Tracker", tid+"Log", tid+"Records", tid+"History",
  ];
  let html = "";
  for(const key of guesses){
    if(d[key] !== undefined && d[key] !== null){
      const rendered = autoRenderValue(d[key]);
      if(rendered && rendered !== "—"){
        html += card(key.replace(/([A-Z])/g," $1").trim().toUpperCase(), rendered);
      }
    }
  }

  // Also scan for any data key containing the tab id
  Object.entries(d).forEach(([k,v])=>{
    if(k.toLowerCase().includes(tid.toLowerCase()) && !guesses.includes(k)){
      const rendered = autoRenderValue(v);
      if(rendered && rendered !== "—"){
        html += card(k.replace(/([A-Z])/g," $1").trim().toUpperCase(), rendered);
      }
    }
  });

  return html || card("Content","See the app for full details of this module.");
}

// ── Shared CSS for all exported documents ────────────────────────────────────
const PDF_CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:Inter,system-ui,Arial,sans-serif;color:#111;padding:20px;font-size:13px;}
.hdr{text-align:center;padding:20px 0;border-bottom:3px solid #FF6B35;margin-bottom:24px;}
.hdr h1{font-size:22px;font-weight:900;color:#FF6B35;letter-spacing:-0.5px;}
.hdr p{font-size:11px;color:#666;margin-top:5px;}
.hdr .meta{font-size:10px;color:#999;margin-top:3px;}
.toc{background:#f8f9fa;border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:28px;}
.toc h2{font-size:13px;font-weight:900;color:#333;margin-bottom:10px;border-bottom:1px solid #ddd;padding-bottom:6px;}
.toc-item{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #eee;font-size:11px;}
.toc-item a{color:#FF6B35;text-decoration:none;font-weight:700;}
.toc-item span{color:#999;}
.group-header{background:linear-gradient(135deg,#FF6B35,#F4A726);color:#fff;padding:8px 14px;border-radius:6px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;margin:20px 0 10px;}
.ps{margin-bottom:24px;page-break-inside:avoid;}
.pt{font-size:15px;font-weight:900;color:#FF6B35;border-bottom:2px solid #FF6B35;padding-bottom:5px;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.pt-id{font-size:10px;color:#999;font-weight:500;margin-left:auto;}
.pdf-card{background:#f8f9fa;border:1px solid #ddd;border-radius:6px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid;}
.pdf-label{font-size:10px;font-weight:700;color:#888;margin-bottom:3px;text-transform:uppercase;}
.pdf-value{font-size:12px;color:#111;line-height:1.7;}
b{font-weight:700;}
pre{white-space:pre-wrap;font-family:inherit;}
.export-meta{background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px;margin-bottom:20px;font-size:11px;color:#666;}
.export-meta b{color:#333;}
@media print{
  body{padding:0;}
  .ps{page-break-inside:avoid;}
  .tb{display:none!important;}
  body.has-toolbar{padding-top:0!important;}
  .group-header{page-break-before:auto;}
}
`.replace(/\n/g," ").replace(/  +/g," ");

const PDF_TOOLBAR_CSS = `
.tb{position:fixed;top:0;left:0;right:0;background:#1a1a2e;padding:10px 14px;display:flex;gap:8px;align-items:center;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,0.5);}
.tb-title{color:#F4A726;font-weight:900;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tb-btn{border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;}
.tb-dl{background:linear-gradient(135deg,#FF6B35,#F4A726);color:#000;}
.tb-pr{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)!important;}
body.has-toolbar{padding-top:56px;}
@media print{.tb{display:none!important;}body.has-toolbar{padding-top:0!important;}}
`;

const PDF_SCRIPT = `
function dlPDF(){
  var html=document.documentElement.outerHTML;
  var blob=new Blob([html],{type:'text/html'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=document.title.replace(/[^a-zA-Z0-9_\\-]/g,'_')+'.html';
  a.click();
}
function prPDF(){window.print();}
`.replace(/\n/g," ");

// ── Build a smart filename ────────────────────────────────────────────────────
function buildPDFFilename(type, sectionLabel){
  const now = new Date();
  const d = now.toISOString().slice(0,10);
  const weekNum = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  const monthName = now.toLocaleString("en-IN",{month:"long"});
  const yr = now.getFullYear();
  if(type==="full") return `LifeOS_${d}.html`;
  if(type==="today") return `Daily_Report_${d}.html`;
  if(type==="weekly") return `Weekly_Report_Week_${weekNum}_${yr}.html`;
  if(type==="monthly") return `Monthly_Report_${monthName}_${yr}.html`;
  if(type==="current" && sectionLabel) return `${sectionLabel.replace(/[^a-zA-Z0-9]/g,"_")}_${d}.html`;
  return `LifeOS_Export_${d}.html`;
}

// ── Generate export metadata block ───────────────────────────────────────────
function buildExportMeta(tabIds, type){
  const now = new Date();
  return `<div class="export-meta">
    <b>Life OS Version:</b> ${APP_VERSION} &nbsp;|&nbsp;
    <b>Schema:</b> v${SCHEMA_VERSION} &nbsp;|&nbsp;
    <b>Export Date:</b> ${now.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})} &nbsp;|&nbsp;
    <b>Export Time:</b> ${now.toLocaleTimeString("en-IN")} &nbsp;|&nbsp;
    <b>Type:</b> ${type} &nbsp;|&nbsp;
    <b>Modules:</b> ${tabIds.length} &nbsp;|&nbsp;
    <b>Generated By:</b> Live Dynamic PDF Engine v2.0
  </div>`;
}

// ── Auto Table of Contents generator ─────────────────────────────────────────
function buildTOC(tabIds){
  const tabMap = Object.fromEntries(EXPORT_TABS.map(t=>[t.id,t]));
  const items = tabIds.map((tid,i)=>{
    const t = tabMap[tid] || {label:tid, group:""};
    return `<div class="toc-item"><a href="#section-${tid}">${t.label}</a><span>Section ${i+1}</span></div>`;
  }).join("");
  return `<div class="toc"><h2>📑 TABLE OF CONTENTS</h2>${items}</div>`;
}

// ── Core HTML wrapper — injects TOC, metadata, toolbar ───────────────────────
function wrapExportHtml(sectionsHTML, titleSuffix, tabIds, exportType){
  const dateStr = new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});
  const fname = titleSuffix || "Atul_Life_OS";
  const toc = tabIds ? buildTOC(tabIds) : "";
  const meta = tabIds ? buildExportMeta(tabIds, exportType||"custom") : "";
  const toolbar = `<div class="tb"><span class="tb-title">🎯 ATUL'S LIFE OS — ${fname}</span><button class="tb-btn tb-dl" onclick="dlPDF()">⬇️ Download</button><button class="tb-btn tb-pr" onclick="prPDF()">🖨️ Print→PDF</button></div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${fname}</title><style>${PDF_CSS}${PDF_TOOLBAR_CSS}</style><script>${PDF_SCRIPT}<\/script></head><body class="has-toolbar">${toolbar}<div class="hdr"><h1>ATUL'S ULTIMATE LIFE OS ${APP_VERSION}</h1><p>${dateStr}</p><p class="meta">Live Dynamic Export — Auto-generated from current data</p></div>${meta}${toc}${sectionsHTML}</body></html>`;
}

// ── Build full export HTML from a list of tab ids ────────────────────────────
function buildFullExportHtml(data, tabIds, exportType){
  const tabMap = Object.fromEntries(EXPORT_TABS.map(t=>[t.id,t]));
  // Group tabs by their group for better PDF structure
  const byGroup = {};
  tabIds.forEach(tid=>{
    const t = tabMap[tid] || {label:tid, group:"OTHER", groupColor:"#666"};
    (byGroup[t.group] = byGroup[t.group] || {color:t.groupColor, tabs:[]}).tabs.push({id:tid, ...t});
  });

  let sectionsHTML = "";
  Object.entries(byGroup).forEach(([grp, {color, tabs}])=>{
    sectionsHTML += `<div class="group-header" style="background:linear-gradient(135deg,${color||"#FF6B35"},${color||"#FF6B35"}99)">${grp}</div>`;
    tabs.forEach(t=>{
      const content = buildTabTextContent(t.id, data);
      sectionsHTML += `<div class="ps" id="section-${t.id}"><div class="pt">${t.label}<span class="pt-id">${t.id}</span></div>${content}</div>`;
    });
  });

  const fname = buildPDFFilename(exportType||"full");
  return wrapExportHtml(sectionsHTML, fname, tabIds, exportType);
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SMART EXPORT & DOWNLOAD SYSTEM v2.0 — Production Download Manager ───────
// ══════════════════════════════════════════════════════════════════════════════

const EXPORT_HISTORY_PREFIX = "export-history-";

// ── Format file size ──────────────────────────────────────────────────────────
function fmtSize(bytes){
  if(!bytes||bytes<1024) return (bytes||0)+"B";
  if(bytes<1048576) return (bytes/1024).toFixed(1)+"KB";
  return (bytes/1048576).toFixed(2)+"MB";
}

// ── Format date/time ──────────────────────────────────────────────────────────
function fmtExportDate(ts){ return ts?new Date(ts).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—"; }
function fmtExportTime(ts){ return ts?new Date(ts).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—"; }

// ── Save export record to history ────────────────────────────────────────────
async function saveExportHistory(record){
  const id = `${EXPORT_HISTORY_PREFIX}${Date.now()}`;
  const byteSize = record.data ? new Blob([record.data]).size : (record.blobSize||0);
  await stSet(id, {
    ...record,
    id,
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    fileSize: byteSize,
    status: "success",
  });
  return id;
}

// ── Load export history list ──────────────────────────────────────────────────
async function loadExportHistory(){
  try {
    const keys = await stList(EXPORT_HISTORY_PREFIX);
    const items = [];
    for(const k of (keys||[])){
      try{ const v = await stGet(k); if(v) items.push({...v, key:k}); }catch(_){}
    }
    items.sort((a,b) => (b.ts||0)-(a.ts||0));
    return items;
  } catch(_){ return []; }
}

// ── Export type icons & colors ────────────────────────────────────────────────
const EXPORT_TYPE_META = {
  full:        {icon:"🌐", color:"#FF6B35", label:"Full Life OS"},
  today:       {icon:"📅", color:"#10B981", label:"Today's Report"},
  weekly:      {icon:"📆", color:"#3B82F6", label:"Weekly Report"},
  monthly:     {icon:"🗓️", color:"#8B5CF6", label:"Monthly Report"},
  current:     {icon:"📌", color:"#F4A726", label:"Current Module"},
  selected:    {icon:"☑️", color:"#14B8A6", label:"Selected Modules"},
  json:        {icon:"🔷", color:"#3B82F6", label:"JSON"},
  csv:         {icon:"📊", color:"#10B981", label:"CSV"},
  zip:         {icon:"🗜️", color:"#F4A726", label:"ZIP"},
  database:    {icon:"🗄️", color:"#8B5CF6", label:"Complete Database"},
  workspace:   {icon:"🏠", color:"#EC4899", label:"Workspace"},
  tab:         {icon:"📋", color:"#14B8A6", label:"Current Tab"},
  module:      {icon:"🧩", color:"#FF6B35", label:"Module"},
  snapshot:    {icon:"📸", color:"#F4A726", label:"Snapshot"},
  backup:      {icon:"💾", color:"#10B981", label:"Backup"},
};
const getExportMeta = t => EXPORT_TYPE_META[t] || {icon:"📄", color:C.muted, label:t||"Export"};

// ─── POST-EXPORT SUCCESS CARD ─────────────────────────────────────────────────
// Shown immediately after any export completes. Provides all access options.
function ExportSuccessCard({ record, onDismiss }){
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const meta = getExportMeta(record.exportType||record.type);

  const doDownload = () => {
    if(!record.data) return;
    const a = document.createElement("a");
    a.href = record.data;
    a.download = record.fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const doOpen = () => {
    if(!record.data) return;
    const w = window.open(record.data, "_blank");
    if(!w) { alert("Pop-up blocked. Use Download instead."); }
  };

  const doCopyLink = () => {
    const txt = record.data || "";
    if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }); }
    else {
      const el=document.createElement("textarea"); el.value=txt; document.body.appendChild(el); el.select();
      try{ document.execCommand("copy"); setCopied(true); setTimeout(()=>setCopied(false),2000); }catch(_){}
      document.body.removeChild(el);
    }
  };

  const doShare = async () => {
    if(navigator.share){
      try{
        await navigator.share({ title: record.fileName, text: `Life OS Export: ${record.fileName}`, url: record.data });
        setShareMsg("✅ Shared!");
      } catch(_){ setShareMsg("Share cancelled"); }
    } else { doCopyLink(); setShareMsg("Link copied (Web Share not supported)"); }
    setTimeout(()=>setShareMsg(""),2500);
  };

  const doSaveToDevice = () => { doDownload(); };

  const doOpenFolder = () => {
    alert("📁 Exports saved in:\nDocuments / Life OS / Exports /\n\nOpen your Files app to browse.");
  };

  return (
    <div style={{background:"rgba(16,185,129,0.06)",border:`2px solid ${C.green}55`,borderRadius:16,padding:16,marginTop:14}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:40,height:40,borderRadius:12,background:`${C.green}20`,border:`1px solid ${C.green}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
          ✅
        </div>
        <div style={{flex:1}}>
          <div style={{color:C.green,fontWeight:900,fontSize:14}}>Export Successful</div>
          <div style={{color:C.muted,fontSize:10,marginTop:1}}>File ready · Saved to history</div>
        </div>
        {onDismiss && <button onClick={onDismiss} style={{background:"rgba(255,255,255,0.06)",border:"none",color:C.muted,borderRadius:7,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✕</button>}
      </div>

      {/* File Info Table */}
      <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
        {[
          ["📄 File Name", record.fileName],
          ["📦 File Size", fmtSize(record.fileSize)],
          ["📅 Date",      fmtExportDate(record.ts)],
          ["🕐 Time",      fmtExportTime(record.ts)],
          ["🔖 Type",      getExportMeta(record.exportType||record.type).label],
          ["📊 Modules",   record.moduleCount ? `${record.moduleCount} modules` : null],
          ["🔢 Version",   record.version||APP_VERSION],
        ].filter(([,v])=>v).map(([label,val],i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderBottom:i<5?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <span style={{color:C.muted,fontSize:10,fontWeight:700}}>{label}</span>
            <span style={{color:C.text,fontSize:11,fontWeight:600,maxWidth:"60%",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</span>
          </div>
        ))}
      </div>

      {/* Primary action — Download */}
      <button onClick={doDownload}
        style={{width:"100%",background:`linear-gradient(135deg,${C.green},#059669)`,border:"none",color:"#fff",borderRadius:11,padding:"13px 0",fontWeight:900,fontSize:14,cursor:"pointer",marginBottom:10,boxShadow:`0 4px 16px ${C.green}40`}}>
        ⬇️ Download File
      </button>

      {/* Secondary action buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
        <button onClick={doOpen}
          style={{background:"rgba(59,130,246,0.15)",border:`1px solid ${C.blue}40`,color:C.blue,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          📂 Open
        </button>
        <button onClick={doShare}
          style={{background:"rgba(139,92,246,0.15)",border:`1px solid ${C.purple}40`,color:C.purple,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          📤 Share
        </button>
        <button onClick={doCopyLink}
          style={{background:copied?"rgba(16,185,129,0.2)":"rgba(244,167,38,0.12)",border:`1px solid ${copied?C.green:C.gold}40`,color:copied?C.green:C.gold,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          {copied?"✅ Copied!":"🔗 Copy Link"}
        </button>
        <button onClick={doSaveToDevice}
          style={{background:"rgba(255,107,53,0.12)",border:`1px solid ${C.saffron}40`,color:C.saffron,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          💾 Save to Device
        </button>
      </div>

      {/* Tertiary: Google Drive & Open Folder */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        <button onClick={()=>window.open("https://drive.google.com","_blank")}
          style={{background:"rgba(66,133,244,0.1)",border:"1px solid rgba(66,133,244,0.3)",color:"#4285F4",borderRadius:9,padding:"8px 0",fontWeight:700,fontSize:11,cursor:"pointer"}}>
          ☁️ Google Drive
        </button>
        <button onClick={doOpenFolder}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:C.muted,borderRadius:9,padding:"8px 0",fontWeight:700,fontSize:11,cursor:"pointer"}}>
          📁 Open Folder
        </button>
      </div>

      {shareMsg && <div style={{color:C.green,fontSize:11,fontWeight:700,textAlign:"center",marginTop:8}}>{shareMsg}</div>}

      <div style={{color:C.muted,fontSize:9,textAlign:"center",marginTop:10,lineHeight:1.6}}>
        📱 Android: Documents / Life OS / Exports &nbsp;|&nbsp; 🌐 Browser: Downloads folder
      </div>
    </div>
  );
}

// ─── EXPORT HISTORY PANEL v2.0 — Full Download Manager ───────────────────────
function ExportHistoryPanel({ autoOpen }){
  const [list, setList]         = useState([]);
  const [open, setOpen]         = useState(!!autoOpen);
  const [loading, setLoading]   = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQ, setSearchQ]   = useState("");
  const [toast, setToast]       = useState("");

  const flash = msg => { setToast(msg); setTimeout(()=>setToast(""),2200); };

  const load = async () => {
    setLoading(true);
    const items = await loadExportHistory();
    setList(items);
    setLoading(false);
  };

  useEffect(()=>{ if(open) load(); },[open]);

  const doDelete = async (key) => {
    await stDel(key);
    setList(l => l.filter(i => i.key !== key));
    setDelConfirm(null);
    if(activeItem?.key===key) setActiveItem(null);
    flash("🗑️ Deleted");
  };

  const doRegenerate = (item) => {
    flash("🔄 Re-export: open the Export panel and re-generate the same type.");
  };

  const doCompare = (item) => {
    flash("⚖️ Compare feature: use Digital Brain → Artifact History for snapshot comparison.");
  };

  const copyLink = (item) => {
    const txt = item.data || "";
    if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(()=>flash("🔗 Link copied!")); }
    else {
      const el=document.createElement("textarea"); el.value=txt; document.body.appendChild(el); el.select();
      try{ document.execCommand("copy"); flash("🔗 Link copied!"); }catch(_){}
      document.body.removeChild(el);
    }
  };

  const allTypes = ["all",...[...new Set(list.map(i=>i.exportType||i.type||"").filter(Boolean))]];
  const filtered = list.filter(i=>{
    if(filterType!=="all" && (i.exportType||i.type||"")!==filterType) return false;
    if(searchQ && !JSON.stringify(i).toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  // Total stats
  const totalSize = list.reduce((s,i)=>s+(i.fileSize||0),0);

  if(activeItem){
    return (
      <div style={{marginTop:14, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:12}}>
        <button onClick={()=>setActiveItem(null)}
          style={{background:"rgba(255,255,255,0.06)",border:"none",color:C.muted,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,marginBottom:10}}>
          ← Back to History
        </button>
        {toast && <div style={{background:"rgba(16,185,129,0.15)",border:`1px solid ${C.green}30`,borderRadius:8,padding:"7px 12px",color:C.green,fontSize:12,fontWeight:700,marginBottom:10}}>{toast}</div>}
        <ExportSuccessCard record={activeItem} onDismiss={()=>setActiveItem(null)} />
        <div style={{marginTop:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            <button onClick={()=>doRegenerate(activeItem)}
              style={{background:`${C.blue}15`,border:`1px solid ${C.blue}30`,color:C.blue,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              🔄 Regenerate
            </button>
            <button onClick={()=>doCompare(activeItem)}
              style={{background:`${C.gold}12`,border:`1px solid ${C.gold}30`,color:C.gold,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              ⚖️ Compare
            </button>
          </div>
          {delConfirm===activeItem.key ? (
            <button onClick={()=>doDelete(activeItem.key)}
              style={{width:"100%",background:`${C.red}20`,border:`1px solid ${C.red}50`,color:C.red,borderRadius:9,padding:"9px 0",fontWeight:800,fontSize:12,cursor:"pointer",marginTop:7}}>
              ⚠️ Confirm Delete — Cannot be undone
            </button>
          ):(
            <button onClick={()=>setDelConfirm(activeItem.key)}
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:C.muted,borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer",marginTop:7}}>
              🗑️ Delete This Export
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{marginTop:14, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:12}}>
      {/* Toggle */}
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.35)",color:"#8B5CF6",borderRadius:10,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>📋</span>
        <span>{open?"Hide":"View"} Export History</span>
        {list.length>0 && <span style={{background:`${C.purple}30`,borderRadius:12,padding:"1px 7px",fontSize:10}}>{list.length}</span>}
      </button>

      {open && (
        <div style={{marginTop:10}}>
          {toast && <div style={{background:"rgba(16,185,129,0.15)",border:`1px solid ${C.green}30`,borderRadius:8,padding:"7px 12px",color:C.green,fontSize:12,fontWeight:700,marginBottom:8}}>{toast}</div>}

          {/* Stats bar */}
          {list.length>0 && (
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[
                {label:"Total Exports", value:list.length, color:C.purple},
                {label:"Total Size",    value:fmtSize(totalSize), color:C.blue},
                {label:"Latest",        value:list[0]?fmtExportDate(list[0].ts):"—", color:C.gold},
              ].map((s,i)=>(
                <div key={i} style={{flex:1,background:`${s.color}10`,border:`1px solid ${s.color}25`,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                  <div style={{color:s.color,fontWeight:900,fontSize:13}}>{s.value}</div>
                  <div style={{color:C.muted,fontSize:9,marginTop:1}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Search + Filter */}
          {list.length>0 && (
            <div style={{marginBottom:10}}>
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 10px",color:C.text,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:6}}
                placeholder="🔍 Search exports..."/>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {allTypes.map(t=>(
                  <button key={t} onClick={()=>setFilterType(t)}
                    style={{padding:"3px 9px",borderRadius:7,border:`1px solid ${filterType===t?getExportMeta(t).color:"rgba(255,255,255,0.1)"}`,background:filterType===t?`${getExportMeta(t).color}20`:"transparent",color:filterType===t?getExportMeta(t).color:C.muted,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                    {t==="all"?"All":getExportMeta(t).label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12}}>⏳ Loading history...</div>}
          {!loading && filtered.length===0 && <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12}}>No export history yet. Generate an export above!</div>}

          {/* History items */}
          {filtered.map((item,i)=>{
            const meta = getExportMeta(item.exportType||item.type);
            return (
              <div key={item.key}
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"11px 12px",marginBottom:8,cursor:"pointer"}}
                onClick={()=>setActiveItem(item)}>
                <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                  {/* Type badge */}
                  <div style={{width:34,height:34,borderRadius:10,background:`${meta.color}15`,border:`1px solid ${meta.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                    {meta.icon}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.text,fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {item.fileName}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{background:`${meta.color}15`,color:meta.color,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{meta.label}</span>
                      <span style={{color:C.muted,fontSize:9}}>{fmtExportDate(item.ts)}</span>
                      <span style={{color:C.muted,fontSize:9}}>{fmtExportTime(item.ts)}</span>
                      {item.fileSize>0 && <span style={{color:C.muted,fontSize:9}}>{fmtSize(item.fileSize)}</span>}
                    </div>
                    {item.moduleCount>0 && <div style={{color:C.muted,fontSize:10,marginTop:2}}>{item.moduleCount} modules &nbsp;·&nbsp; v{item.version||APP_VERSION}</div>}
                  </div>
                  {/* Quick download */}
                  <button onClick={e=>{e.stopPropagation();if(item.data){const a=document.createElement("a");a.href=item.data;a.download=item.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);}}}
                    style={{background:`${C.green}15`,border:`1px solid ${C.green}30`,color:C.green,borderRadius:8,padding:"6px 9px",fontSize:12,cursor:"pointer",flexShrink:0}}
                    title="Quick Download">⬇️</button>
                  {delConfirm===item.key ? (
                    <button onClick={e=>{e.stopPropagation();doDelete(item.key);}}
                      style={{background:`${C.red}20`,border:`1px solid ${C.red}40`,color:C.red,borderRadius:8,padding:"6px 9px",fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
                  ):(
                    <button onClick={e=>{e.stopPropagation();setDelConfirm(item.key);setTimeout(()=>setDelConfirm(null),3000);}}
                      style={{background:"rgba(255,255,255,0.04)",border:"none",color:C.muted,borderRadius:8,padding:"6px 9px",fontSize:11,cursor:"pointer",flexShrink:0}}>🗑️</button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length>0 && (
            <div style={{color:C.muted,fontSize:10,textAlign:"center",marginTop:6}}>
              Tap any export to open · ⬇️ to re-download
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Kept for backward compat with StorageTab
function SavedPDFsList(){ return <ExportHistoryPanel />; }

// ─── EXPORT HUB v2.0 — Smart Export & Download Manager ──────────────────────
function PDFModal({onClose, data, tab}){
  // ── Main mode: PDF vs other formats ─────────────────────────────────────────
  const [mode, setMode] = useState("pdf"); // "pdf"|"data"|"history"

  // ── PDF Export state ─────────────────────────────────────────────────────────
  const EXPORT_TYPES = [
    {id:"full",      label:"📚 Full Life OS",       sub:`All ${EXPORT_TABS.length} modules — complete dynamic document`},
    {id:"today",     label:"📅 Today's Report",      sub:"Dashboard + all daily data for today"},
    {id:"weekly",    label:"📆 Weekly Report",       sub:"This week's data — study, health, habits"},
    {id:"monthly",   label:"🗓️ Monthly Report",      sub:"Full month overview and analytics"},
    {id:"current",   label:"📌 Current Module Only", sub:`Exports: ${TABS.find(t=>t.id===tab)?.label||tab}`},
    {id:"selected",  label:"☑️ Choose Modules",      sub:"Pick any combination of modules"},
  ];

  const [exportType, setExportType] = useState("full");
  const [selected, setSelected] = useState(
    Object.fromEntries(EXPORT_TABS.map(t=>[t.id, ["identity","schedule","study","health","progress","checklist"].includes(t.id)]))
  );
  const [status, setStatus]     = useState("idle");
  const [msg, setMsg]           = useState("");
  const [pdfUri, setPdfUri]     = useState(null);
  const [pdfName, setPdfName]   = useState("");
  const [pdfRaw, setPdfRaw]     = useState("");
  const [exportRecord, setExportRecord] = useState(null);
  const [showModules, setShowModules]   = useState(false);

  // ── Data Export state ────────────────────────────────────────────────────────
  const [dataExportType, setDataExportType] = useState("json"); // json|csv|zip|database|workspace|snapshot|backup
  const [dataStatus, setDataStatus]   = useState("idle");
  const [dataRecord,  setDataRecord]  = useState(null);
  const [dataMsg,     setDataMsg]     = useState("");

  const ALL_MODULES = EXPORT_TABS;
  const toggleModule = id => setSelected(s => ({...s, [id]: !s[id]}));
  const selectAll = () => setSelected(Object.fromEntries(ALL_MODULES.map(t=>[t.id,true])));
  const clearAll  = () => setSelected(Object.fromEntries(ALL_MODULES.map(t=>[t.id,false])));

  const getTabIds = () => {
    if(exportType === "current") return [tab];
    if(exportType === "selected") return ALL_MODULES.filter(t=>selected[t.id]).map(t=>t.id);
    const ordered = [
      "command","myday","onetask","pomodoro","checklist","countdown",
      "study","schedule","mcqtracker","pyqtracker","mistakebook","masterplan",
      "analytics","metrics","progress","scorecard","habitheatmap","tracker",
      "identity","reflection","ceoreview","selfctrl","flow","spiritual",
      "health","vitality","happiness","environment","community","money",
      "knowledge","ideas","voicenotes","content","digital","finance","storage","quickref","timeline","brain",
    ];
    if(exportType === "full")    return ordered.filter(id => ALL_MODULES.find(m=>m.id===id));
    if(exportType === "today")   return ["command","myday","onetask","checklist","health","study","analytics"].filter(id=>ALL_MODULES.find(m=>m.id===id));
    if(exportType === "weekly")  return ["analytics","progress","scorecard","habitheatmap","study","health","money"].filter(id=>ALL_MODULES.find(m=>m.id===id));
    if(exportType === "monthly") return ["analytics","metrics","progress","scorecard","study","health","money","goals","habitheatmap","identity","masterplan"].filter(id=>ALL_MODULES.find(m=>m.id===id));
    return ordered.filter(id=>ALL_MODULES.find(m=>m.id===id));
  };

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const doExport = async () => {
    setStatus("loading");
    setPdfUri(null);
    setExportRecord(null);
    try {
      setMsg("🔍 Scanning modules...");
      await new Promise(r=>setTimeout(r,10));
      const tabIds = getTabIds();
      if(tabIds.length === 0){ setStatus("error"); setMsg("No modules selected."); return; }

      setMsg(`📊 Reading live data (${tabIds.length} modules)...`);
      await new Promise(r=>setTimeout(r,10));

      const tabMap = Object.fromEntries(ALL_MODULES.map(t=>[t.id,t]));
      const byGroup = {};
      tabIds.forEach(tid=>{
        const t = tabMap[tid] || {label:tid, group:"OTHER", groupColor:"#666"};
        (byGroup[t.group] = byGroup[t.group] || {color:t.groupColor, tabs:[]}).tabs.push({id:tid, ...t});
      });

      let sectionsHTML = "";
      let sectionCount = 0;
      for(const [grp, {color, tabs}] of Object.entries(byGroup)){
        sectionsHTML += `<div class="group-header" style="background:linear-gradient(135deg,${color||"#FF6B35"},${color||"#F4A726"}88)">${grp}</div>`;
        for(const t of tabs){
          setMsg(`⚙️ Building: ${t.label}...`);
          await new Promise(r=>setTimeout(r,5));
          const content = buildTabTextContent(t.id, data);
          sectionsHTML += `<div class="ps" id="section-${t.id}"><div class="pt">${t.label}<span class="pt-id">${t.id}</span></div>${content}</div>`;
          sectionCount++;
        }
      }

      setMsg("📝 Generating document...");
      const fname = buildPDFFilename(exportType, TABS.find(t=>t.id===tab)?.label);
      const html = wrapExportHtml(sectionsHTML, fname, tabIds, exportType);

      setMsg("💾 Saving to history...");
      const uri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      const blobSize = new Blob([html]).size;
      const exportRec = {
        ts: Date.now(),
        fileName: fname,
        exportType,
        moduleCount: sectionCount,
        data: uri,
        tabIds,
        fileSize: blobSize,
        version: APP_VERSION,
        status: "success",
      };
      await saveExportHistory(exportRec);
      await stSet("pdffull-"+new Date().toISOString().slice(0,10)+"-"+Date.now(), {
        date: new Date().toISOString().slice(0,10),
        savedAt: Date.now(),
        name: fname,
        data: uri,
      });

      setPdfUri(uri);
      setPdfName(fname);
      setPdfRaw(html);
      setExportRecord(exportRec);
      setStatus("done");
      setMsg(`✅ Done! ${sectionCount} modules · ${(blobSize/1024).toFixed(1)}KB`);
    } catch(err){
      setStatus("error");
      setMsg("❌ Export failed: " + err.message);
    }
  };

  // ── Data Export (JSON / CSV / ZIP / Database / Workspace / Snapshot / Backup) ──
  const DATA_EXPORT_TYPES = [
    {id:"json",      icon:"🔷", label:"JSON",              color:"#3B82F6", sub:"Full workspace as structured JSON"},
    {id:"csv",       icon:"📊", label:"CSV",               color:"#10B981", sub:"Spreadsheet-friendly tabular data"},
    {id:"database",  icon:"🗄️", label:"Complete Database",  color:"#8B5CF6", sub:"All storage keys — every field"},
    {id:"workspace", icon:"🏠", label:"Current Workspace",  color:"#EC4899", sub:`${TAB_GROUPS.find(g=>g.id==="today")?.label||"Active"} group data`},
    {id:"snapshot",  icon:"📸", label:"Snapshot",           color:"#F4A726", sub:"Point-in-time copy of live data"},
    {id:"backup",    icon:"💾", label:"Backup",             color:"#10B981", sub:"Emergency backup — full safe copy"},
  ];

  const doDataExport = async () => {
    setDataStatus("loading");
    setDataRecord(null);
    setDataMsg("📦 Preparing export...");
    await new Promise(r=>setTimeout(r,20));
    try {
      let content = "";
      let fileName = "";
      let mimeType = "application/json";
      const ts = Date.now();
      const dateStr = todayStr();

      if(dataExportType === "json"){
        content = JSON.stringify({
          exportedAt: new Date().toISOString(),
          exportType: "workspace-json",
          version: APP_VERSION,
          workspace: data,
        }, null, 2);
        fileName = `LifeOS_Workspace_${dateStr}.json`;
        setDataMsg("🔷 Building JSON...");
      }
      else if(dataExportType === "csv"){
        setDataMsg("📊 Building CSV...");
        const rows = [["Field", "Value", "Type"]];
        const flatten = (obj, prefix="") => {
          Object.entries(obj||{}).forEach(([k,v])=>{
            const key = prefix ? `${prefix}.${k}` : k;
            if(typeof v === "object" && v !== null && !Array.isArray(v)){
              flatten(v, key);
            } else {
              const val = Array.isArray(v) ? JSON.stringify(v) : String(v??'');
              rows.push([key, val.replace(/,/g,"·").replace(/\n/g," "), typeof v]);
            }
          });
        };
        flatten(data);
        content = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
        fileName = `LifeOS_Data_${dateStr}.csv`;
        mimeType = "text/csv";
      }
      else if(dataExportType === "database"){
        setDataMsg("🗄️ Reading all storage keys...");
        const full = await DataManager.exportFull(data, "Complete Database Export v42");
        content = JSON.stringify(full, null, 2);
        fileName = `LifeOS_FullDB_${dateStr}.json`;
      }
      else if(dataExportType === "workspace"){
        setDataMsg("🏠 Capturing workspace...");
        content = JSON.stringify({
          exportedAt: new Date().toISOString(),
          exportType: "workspace",
          version: APP_VERSION,
          data,
        }, null, 2);
        fileName = `LifeOS_Workspace_${dateStr}.json`;
      }
      else if(dataExportType === "snapshot"){
        setDataMsg("📸 Creating snapshot...");
        content = JSON.stringify({
          exportedAt: new Date().toISOString(),
          exportType: "snapshot",
          snapshotId: "snap-"+ts,
          version: APP_VERSION,
          data,
        }, null, 2);
        fileName = `LifeOS_Snapshot_${dateStr}_${ts}.json`;
      }
      else if(dataExportType === "backup"){
        setDataMsg("💾 Creating backup...");
        const backupId = await DataManager.manualBackup(data, `Manual Backup ${new Date().toLocaleString()}`);
        const full = await DataManager.exportFull(data, "Manual Backup Export");
        content = JSON.stringify({...full, backupId}, null, 2);
        fileName = `LifeOS_Backup_${dateStr}.json`;
      }

      await new Promise(r=>setTimeout(r,20));
      const blob = new Blob([content], {type: mimeType+";charset=utf-8"});
      const blobSize = blob.size;
      const uri = URL.createObjectURL(blob);

      // Trigger download immediately
      const a = document.createElement("a");
      a.href = uri;
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(uri), 30000);

      // Build data URI for history (use a data URI copy for small files, blob info for large)
      const dataUri = blobSize < 2*1024*1024
        ? `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`
        : uri;

      const record = {
        ts,
        fileName,
        exportType: dataExportType,
        type: dataExportType,
        data: dataUri,
        fileSize: blobSize,
        version: APP_VERSION,
        status: "success",
      };
      await saveExportHistory(record);
      setDataRecord(record);
      setDataStatus("done");
      setDataMsg(`✅ ${fileName} · ${fmtSize(blobSize)} — downloading…`);
    } catch(err){
      setDataStatus("error");
      setDataMsg("❌ Export failed: " + err.message);
    }
  };

  const selectedCount = exportType==="selected"?Object.values(selected).filter(Boolean).length:getTabIds().length;

  const MODE_TABS = [
    {id:"pdf",     icon:"📄", label:"PDF / HTML"},
    {id:"data",    icon:"🔷", label:"JSON / CSV"},
    {id:"history", icon:"📋", label:"History"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0e0e1e",border:"1px solid rgba(255,255,255,0.12)",borderRadius:22,padding:22,width:"100%",maxWidth:440,maxHeight:"92vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{color:C.gold,fontWeight:900,fontSize:17}}>⬇️ Export Hub v2.0</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>Live data · Auto-downloaded · Saved to history</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",color:C.muted,borderRadius:9,padding:"6px 11px",cursor:"pointer",fontSize:14}}>✕</button>
        </div>

        {/* Mode Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {MODE_TABS.map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)}
              style={{flex:1,background:mode===m.id?`${C.gold}18`:"rgba(255,255,255,0.04)",
                border:`1px solid ${mode===m.id?C.gold+"55":"rgba(255,255,255,0.08)"}`,
                borderRadius:10,padding:"8px 4px",cursor:"pointer",fontWeight:700,
                color:mode===m.id?C.gold:C.muted,fontSize:11}}>
              <div>{m.icon}</div>
              <div style={{marginTop:2}}>{m.label}</div>
            </button>
          ))}
        </div>

        {/* ── MODE: PDF ──────────────────────────────────────────────────────── */}
        {mode==="pdf" && (
          <>
            {/* Export Type Selector */}
            <div style={{marginBottom:16}}>
              <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>EXPORT TYPE</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {EXPORT_TYPES.map(opt=>(
                  <div key={opt.id} onClick={()=>{setExportType(opt.id);setPdfUri(null);setStatus("idle");setExportRecord(null);}}
                    style={{background:exportType===opt.id?"rgba(244,167,38,0.1)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${exportType===opt.id?C.gold+"66":"rgba(255,255,255,0.07)"}`,
                      borderRadius:11,padding:"9px 13px",cursor:"pointer",display:"flex",gap:11,alignItems:"center"}}>
                    <div style={{width:17,height:17,borderRadius:"50%",border:`2px solid ${exportType===opt.id?C.gold:"rgba(255,255,255,0.2)"}`,
                      background:exportType===opt.id?C.gold:"transparent",flexShrink:0}}/>
                    <div>
                      <div style={{color:C.text,fontWeight:700,fontSize:13}}>{opt.label}</div>
                      <div style={{color:C.muted,fontSize:10,marginTop:1}}>{opt.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Module selector */}
            {exportType==="selected" && (
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:1}}>SELECT MODULES ({selectedCount})</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={selectAll} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.green,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>All</button>
                    <button onClick={clearAll}  style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:700}}>None</button>
                  </div>
                </div>
                {TAB_GROUPS.map(g=>(
                  <div key={g.id} style={{marginBottom:10}}>
                    <div style={{fontSize:9,fontWeight:900,color:g.color,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>
                      {g.icon} {g.label}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                      {g.tabs.map(t=>(
                        <div key={t.id} onClick={()=>toggleModule(t.id)}
                          style={{display:"flex",gap:7,alignItems:"center",background:"rgba(0,0,0,0.25)",
                            border:`1px solid ${selected[t.id]?g.color+"55":"rgba(255,255,255,0.05)"}`,
                            borderRadius:8,padding:"6px 9px",cursor:"pointer"}}>
                          <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${selected[t.id]?g.color:"rgba(255,255,255,0.2)"}`,
                            background:selected[t.id]?g.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {selected[t.id]&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                          </div>
                          <span style={{color:selected[t.id]?C.text:C.muted,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.icon} {t.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Module count badge */}
            {exportType !== "selected" && (
              <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 12px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.muted,fontSize:11}}>Modules detected</span>
                <span style={{color:C.gold,fontWeight:900,fontSize:14}}>{selectedCount}</span>
              </div>
            )}

            {/* Status */}
            {status !== "idle" && (
              <div style={{background:status==="error"?"rgba(239,68,68,0.1)":status==="done"?"rgba(16,185,129,0.1)":"rgba(59,130,246,0.07)",
                border:`1px solid ${status==="error"?C.red+"33":status==="done"?C.green+"33":C.blue+"33"}`,
                borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,
                color:status==="error"?C.red:status==="done"?C.green:C.text}}>
                {status==="loading"&&<span style={{display:"inline-block",animation:"spin 1s linear infinite",marginRight:6}}>⏳</span>}
                {msg}
              </div>
            )}

            {/* Action buttons */}
            <div style={{display:"flex",gap:8}}>
              <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"12px 0",fontWeight:700,cursor:"pointer",fontSize:13}}>Cancel</button>
              <button onClick={doExport} disabled={status==="loading"}
                style={{flex:2,background:status==="loading"?"rgba(244,167,38,0.25)":`linear-gradient(135deg,${C.saffron},${C.gold})`,border:"none",
                  color:status==="loading"?C.muted:"#000",borderRadius:10,padding:"12px 0",fontWeight:900,
                  cursor:status==="loading"?"not-allowed":"pointer",fontSize:13}}>
                {status==="loading"?"⏳ Building...":"🚀 Generate & Download"}
              </button>
            </div>

            {/* ✅ Export Success Card */}
            {pdfUri && status==="done" && exportRecord && (
              <ExportSuccessCard record={exportRecord} onDismiss={()=>{setPdfUri(null);setExportRecord(null);setStatus("idle");}} />
            )}

            <div style={{color:C.muted,fontSize:10,textAlign:"center",marginTop:12,lineHeight:1.6}}>
              📱 Android: Documents / Life OS / Exports &nbsp;·&nbsp; ⚡ Always live data
            </div>
          </>
        )}

        {/* ── MODE: DATA EXPORT ──────────────────────────────────────────────── */}
        {mode==="data" && (
          <>
            <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:10}}>SELECT FORMAT</div>
            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
              {DATA_EXPORT_TYPES.map(opt=>(
                <div key={opt.id} onClick={()=>{setDataExportType(opt.id);setDataStatus("idle");setDataRecord(null);setDataMsg("");}}
                  style={{background:dataExportType===opt.id?`${opt.color}12`:"rgba(255,255,255,0.03)",
                    border:`1px solid ${dataExportType===opt.id?opt.color+"55":"rgba(255,255,255,0.07)"}`,
                    borderRadius:11,padding:"10px 13px",cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${opt.color}15`,border:`1px solid ${opt.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                    {opt.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color:dataExportType===opt.id?opt.color:C.text,fontWeight:700,fontSize:13}}>{opt.label}</div>
                    <div style={{color:C.muted,fontSize:10,marginTop:1}}>{opt.sub}</div>
                  </div>
                  {dataExportType===opt.id && <div style={{color:opt.color,fontSize:14}}>●</div>}
                </div>
              ))}
            </div>

            {dataMsg && (
              <div style={{background:dataStatus==="error"?"rgba(239,68,68,0.1)":dataStatus==="done"?"rgba(16,185,129,0.1)":"rgba(59,130,246,0.07)",
                border:`1px solid ${dataStatus==="error"?C.red+"33":dataStatus==="done"?C.green+"33":C.blue+"33"}`,
                borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,
                color:dataStatus==="error"?C.red:dataStatus==="done"?C.green:C.text}}>
                {dataStatus==="loading"&&<span style={{display:"inline-block",animation:"spin 1s linear infinite",marginRight:6}}>⏳</span>}
                {dataMsg}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"12px 0",fontWeight:700,cursor:"pointer",fontSize:13}}>Cancel</button>
              <button onClick={doDataExport} disabled={dataStatus==="loading"}
                style={{flex:2,background:dataStatus==="loading"?"rgba(16,185,129,0.2)":`linear-gradient(135deg,${C.green},#059669)`,border:"none",
                  color:dataStatus==="loading"?C.muted:"#000",borderRadius:10,padding:"12px 0",fontWeight:900,
                  cursor:dataStatus==="loading"?"not-allowed":"pointer",fontSize:13}}>
                {dataStatus==="loading"?"⏳ Exporting...":"⬇️ Export & Download"}
              </button>
            </div>

            {dataRecord && dataStatus==="done" && (
              <ExportSuccessCard record={dataRecord} onDismiss={()=>{setDataRecord(null);setDataStatus("idle");setDataMsg("");}} />
            )}

            <div style={{color:C.muted,fontSize:10,textAlign:"center",marginTop:12,lineHeight:1.6}}>
              📱 Android: Documents / Life OS / Exports &nbsp;·&nbsp; 💡 Always exports latest live data
            </div>
          </>
        )}

        {/* ── MODE: HISTORY ──────────────────────────────────────────────────── */}
        {mode==="history" && (
          <ExportHistoryPanel autoOpen={true} />
        )}

      </div>
    </div>
  );
}

// ─── DAILY STORAGE TAB ────────────────────────────────────────────────────────
// App.set() writes a dated snapshot (archive:full:<date>) on every save, so this
// tab turns those into clickable date "links" — browse, preview, restore, or
// delete any past day's full state, or just one tab's state, on demand.
// ─── MY DAY TAB ───────────────────────────────────────────────────────────────
function MyDayTab(){
  const{data,set}=useEC();
  const IS={background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,width:"100%",fontSize:13};

  const WEEK_DAYS=[
    {day:"Monday",icon:"💪",color:C.blue,study:"Full Rotation Engine — All Subjects",youtube:"Idea",ytColor:C.purple},
    {day:"Tuesday",icon:"🌾",color:C.green,study:"Full Rotation Engine — Agriculture + Quant",youtube:"Research",ytColor:C.teal},
    {day:"Wednesday",icon:"📝",color:C.teal,study:"Full Rotation Engine — Agriculture + Quant",youtube:"Script",ytColor:C.gold},
    {day:"Thursday",icon:"🔄",color:C.blue,study:"Full Rotation Engine — All Subjects",youtube:"Record",ytColor:C.red},
    {day:"Friday",icon:"✂️",color:C.purple,study:"Full Rotation Engine — All Subjects",youtube:"Edit",ytColor:C.saffron},
    {day:"Saturday",icon:"🎯",color:C.red,study:"MOCK TEST NIGHT",youtube:null,ytColor:null,special:"Normal day 8:00–10:00 PM Mock Test",specialColor:C.red},
    {day:"Sunday",icon:"🌟",color:C.gold,study:"REVISION + AUDIT",youtube:null,ytColor:null,special:"Mock deep analysis. Full week revision. Anki. PYQs. Power Hour.",specialColor:C.gold},
  ];

  const WEEKLY_REVIEW=[
    {num:1,step:"Coverage Check",detail:"Actual vs weekly goal. Lagging / Ahead / On Track."},
    {num:2,step:"Topic Completion Count",detail:"Planned vs actual per subject."},
    {num:3,step:"Active Recall Check",detail:"Planned vs actual time."},
    {num:4,step:"Mock Performance",detail:"Strengths + weak areas."},
    {num:5,step:"Next Week Adjustment",detail:"Increase target or add session if lagging."},
    {num:6,step:"Revision Focus Plan",detail:"Weak topics = next revision block focus."},
    {num:7,step:"Reflection",detail:"Honest 2-3 lines; what worked, what didn\'t."},
  ];

  const MONTHLY_TASKS=[
    {icon:"⚖️",item:"Weight Check",detail:"Trend, not daily"},
    {icon:"🏠",item:"Environment Upgrade",detail:"Desk/room refresh"},
    {icon:"📖",item:"Full Revision Day",detail:"Last Sunday — entire month scan"},
    {icon:"📊",item:"Progress Review",detail:"Mock trend, weak topics trend"},
    {icon:"🔀",item:"Interleaved Practice",detail:"All subjects MCQs mixed"},
    {icon:"🔍",item:"Habit Audit",detail:"What works → keep. What doesn\'t → drop."},
  ];

  const notes=data.mydayNotes||{};
  const setNote=(day,val)=>set("mydayNotes",{...notes,[day]:val});
  const reviewChecks=data.mydayReviewChecks||{};
  const toggleCheck=(i)=>set("mydayReviewChecks",{...reviewChecks,[i]:!reviewChecks[i]});
  const monthChecks=data.mydayMonthChecks||{};
  const toggleMonth=(i)=>set("mydayMonthChecks",{...monthChecks,[i]:!monthChecks[i]});

  return(
    <div>
      <SectionTitle icon="🗓️" title="My Day" sub="Weekly engine — study rotation, YouTube pipeline & review system."/>

      <Card>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:12,letterSpacing:1}}>📅 WEEKLY STUDY + CONTENT ROTATION</div>
        {WEEK_DAYS.map((d,i)=>(
          <div key={i} style={{background:`${d.color}0d`,border:`1px solid ${d.color}33`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{d.icon}</span>
                <span style={{color:d.color,fontWeight:800,fontSize:14}}>{d.day}</span>
              </div>
              {d.youtube&&(
                <span style={{background:`${d.ytColor}22`,border:`1px solid ${d.ytColor}55`,color:d.ytColor,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                  🎥 {d.youtube}
                </span>
              )}
            </div>
            <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:d.special?6:0}}>
              <span style={{background:`${d.color}22`,color:d.color,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0,marginTop:2}}>STUDY</span>
              <span style={{color:C.text,fontSize:13,fontWeight:600}}>{d.study}</span>
            </div>
            {d.special&&(
              <div style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:4}}>
                <span style={{background:`${d.specialColor}22`,color:d.specialColor,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0,marginTop:2}}>NOTE</span>
                <span style={{color:C.muted,fontSize:12}}>{d.special}</span>
              </div>
            )}
            <textarea
              rows={2}
              style={{...IS,marginTop:8,fontSize:12,resize:"none"}}
              placeholder={`${d.day} notes / plan...`}
              value={notes[d.day]||""}
              onChange={e=>setNote(d.day,e.target.value)}
            />
          </div>
        ))}
      </Card>

      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:12,letterSpacing:1}}>📋 WEEKLY REVIEW STEPS</div>
        {WEEKLY_REVIEW.map((r,i)=>(
          <div key={i}
            onClick={()=>toggleCheck(i)}
            style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 0",borderBottom:i<WEEKLY_REVIEW.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${reviewChecks[i]?C.green:C.blue}`,background:reviewChecks[i]?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.2s"}}>
              {reviewChecks[i]&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{color:reviewChecks[i]?C.muted:C.text,fontWeight:700,fontSize:13,textDecoration:reviewChecks[i]?"line-through":"none"}}>
                {r.num}. {r.step}
              </div>
              <div style={{color:C.muted,fontSize:11,marginTop:2}}>{r.detail}</div>
            </div>
          </div>
        ))}
        <div style={{marginTop:10,background:"rgba(59,130,246,0.08)",borderRadius:8,padding:"7px 10px",fontSize:11,color:C.blue,fontWeight:600}}>
          ✅ {Object.values(reviewChecks).filter(Boolean).length} / {WEEKLY_REVIEW.length} steps completed
        </div>
      </Card>

      <Card glow={C.gold}>
        <div style={{fontSize:12,color:C.gold,fontWeight:700,marginBottom:12,letterSpacing:1}}>📆 MONTHLY TASKS</div>
        {MONTHLY_TASKS.map((m,i)=>(
          <div key={i}
            onClick={()=>toggleMonth(i)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<MONTHLY_TASKS.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${monthChecks[i]?C.green:C.gold}`,background:monthChecks[i]?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
              {monthChecks[i]&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
            </div>
            <span style={{fontSize:18,flexShrink:0}}>{m.icon}</span>
            <div style={{flex:1}}>
              <div style={{color:monthChecks[i]?C.muted:C.text,fontWeight:700,fontSize:13,textDecoration:monthChecks[i]?"line-through":"none"}}>{m.item}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:1}}>{m.detail}</div>
            </div>
          </div>
        ))}
        <div style={{marginTop:10,background:"rgba(244,167,38,0.08)",borderRadius:8,padding:"7px 10px",fontSize:11,color:C.gold,fontWeight:600}}>
          ✅ {Object.values(monthChecks).filter(Boolean).length} / {MONTHLY_TASKS.length} tasks done this month
        </div>
      </Card>

      {/* Weekly Architecture, Review Agenda, Tracker, Sunday Power Hour, Monthly System */}
      <Card>
        <div style={{fontSize:12,color:"#94A3B8",fontWeight:700,marginBottom:10,letterSpacing:1}}>🗺️ WEEKLY ARCHITECTURE (Editable)</div>
        <ObjList path="weeklyDays"
          fields={[{key:"day",label:"Day"},{key:"focus",label:"Focus"},{key:"detail",label:"Detail"}]}
          blank={{day:"Day",focus:"Focus Area",detail:"...",highlight:false}}
          addLabel="Add Day"
          renderRow={w=>(
            <div style={{background:w.highlight?"rgba(59,130,246,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${w.highlight?"rgba(59,130,246,0.27)":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"10px 14px",marginBottom:6}}>
              <span style={{color:w.highlight?"#3B82F6":"#94A3B8",fontWeight:800,fontSize:12}}>{w.day}</span>
              <div style={{color:w.highlight?"#F8FAFC":"#B8C7D8",fontWeight:w.highlight?700:400,fontSize:14,marginTop:2}}>{w.focus}</div>
              <div style={{color:"#94A3B8",fontSize:12,marginTop:4}}>{w.detail}</div>
            </div>
          )}
        />
      </Card>

      <Card glow={C.blue}>
        <div style={{fontSize:12,color:C.blue,fontWeight:700,marginBottom:10,letterSpacing:1}}>📋 WEEKLY REVIEW AGENDA (Editable)</div>
        <ObjList path="weeklyReview"
          fields={[{key:"step",label:"Step"},{key:"detail",label:"Detail"}]}
          blank={{step:"New Step",detail:"..."}}
          addLabel="Add Review Step"
          renderRow={(w,i)=>(
            <div style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{color:"#F8FAFC",fontWeight:700,fontSize:12}}>{i+1}. {w.step}</div>
              <div style={{color:"#94A3B8",fontSize:11,marginTop:2}}>{w.detail}</div>
            </div>
          )}
        />
      </Card>

      <Card>
        <div style={{fontSize:12,color:"#94A3B8",fontWeight:700,marginBottom:10,letterSpacing:1}}>📝 WEEKLY REVIEW TRACKER (Subject / Planned / Actual)</div>
        <WeeklyReviewTracker/>
      </Card>

      <Card glow={C.saffron}>
        <div style={{fontSize:12,color:C.saffron,fontWeight:700,marginBottom:10,letterSpacing:1}}>⭐ SUNDAY POWER HOUR</div>
        {(data.sundayPowerHour||[]).map((item,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:i<((data.sundayPowerHour||[]).length-1)?"1px solid rgba(255,255,255,0.08)":"none"}}>
            <span style={{color:item.color||"#F4A726",fontSize:12,fontWeight:700,minWidth:90}}>{item.time}</span>
            <span style={{color:"#F8FAFC",fontSize:13}}>{item.activity}</span>
          </div>
        ))}
        <div style={{marginTop:10}}>
          <ObjList path="sundayPowerHour"
            fields={[{key:"time",label:"Time"},{key:"activity",label:"Activity"},{key:"color",label:"Color (hex)"}]}
            blank={{time:"00:00-00:20",activity:"New Block",color:"#F4A726"}}
            addLabel="Edit Sunday Power Hour"
            renderRow={()=>null}
          />
        </div>
      </Card>

      <Card>
        <div style={{fontSize:12,color:"#94A3B8",fontWeight:700,marginBottom:10,letterSpacing:1}}>📆 MONTHLY SYSTEM (Editable)</div>
        <ObjList path="monthlyItems"
          fields={[{key:"item",label:"Item"},{key:"detail",label:"Detail"}]}
          blank={{item:"New Monthly Item",detail:"..."}}
          addLabel="Add Monthly Item"
          renderRow={m=>(
            <div style={{padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              <span style={{color:"#F4A726",fontWeight:700,fontSize:13}}>{m.item}: </span>
              <span style={{color:"#94A3B8",fontSize:12}}>{m.detail}</span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}


// ── WeeklyReviewTracker: Subject / Planned / Actual inline mini-table ────────────────────
function WeeklyReviewTracker(){
  const[rRows,setRRows]=useState([{subject:"",planned:"",actual:""}]);
  const updRow=(i,field,val)=>{const u=rRows.slice();u[i]={...u[i],[field]:val};setRRows(u);};
  const addRow=()=>setRRows([...rRows,{subject:"",planned:"",actual:""}]);
  const remRow=i=>rRows.length>1&&setRRows(rRows.filter((_,j)=>j!==i));
  const trIS={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 10px",color:"#F8FAFC",fontSize:12,width:"100%",boxSizing:"border-box",outline:"none"};
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <div style={{flex:2,fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",paddingLeft:4}}>Subject</div>
        <div style={{flex:1,fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",paddingLeft:4}}>Planned</div>
        <div style={{flex:1,fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",paddingLeft:4}}>Actual</div>
        <div style={{width:24}}/>
      </div>
      {rRows.map((r,i)=>(
        <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
          <input style={{...trIS,flex:2}} placeholder="e.g. Agriculture" value={r.subject} onChange={e=>updRow(i,"subject",e.target.value)}/>
          <input style={{...trIS,flex:1}} placeholder="e.g. 2h" value={r.planned} onChange={e=>updRow(i,"planned",e.target.value)}/>
          <input style={{...trIS,flex:1}} placeholder="e.g. 1h 40m" value={r.actual} onChange={e=>updRow(i,"actual",e.target.value)}/>
          <button onClick={()=>remRow(i)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:"#EF4444",borderRadius:4,width:24,height:32,fontSize:12,cursor:"pointer",flexShrink:0}}>x</button>
        </div>
      ))}
      <button onClick={addRow} style={{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",color:"#10B981",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:700,width:"100%"}}>+ Add Subject Row</button>
    </div>
  );
}

function StorageTab(){
  const{data,tab,archiveTabNow,restoreAll,restoreTab}=useEC();
  const[view,setView]=useState("overview");
  const[fullList,setFullList]=useState([]);
  const[tabGroups,setTabGroups]=useState({});
  const[pdfList,setPdfList]=useState([]);
  const[pdfTabGroups,setPdfTabGroups]=useState({});
  const[backups,setBackups]=useState([]);
  const[integrity,setIntegrity]=useState([]);
  const[meta,setMeta]=useState(null);
  const[loading,setLoading]=useState(true);
  const[confirmKey,setConfirmKey]=useState(null);
  const[toast,setToast]=useState("");
  const[savingNow,setSavingNow]=useState(false);
  const[saveNotes,setSaveNotes]=useState("");
  const[pdfNotes,setPdfNotes]=useState("");
  const[manualBackupName,setManualBackupName]=useState("");
  const[openBackup,setOpenBackup]=useState(null);
  const[openBackupData,setOpenBackupData]=useState(null);
  const[restorePreview,setRestorePreview]=useState(null);
  const[copied,setCopied]=useState(null);
  const[debugLog,setDebugLog]=useState([]);
  const[importText,setImportText]=useState("");
  const[importMsg,setImportMsg]=useState("");

  const dbg=msg=>setDebugLog(l=>[`${new Date().toLocaleTimeString("en-IN")} — ${msg}`,...l].slice(0,15));
  const flash=msg=>{setToast(msg);setTimeout(()=>setToast(""),2400);};
  const copyText=async(txt,id)=>{
    try{
      if(navigator.clipboard){await navigator.clipboard.writeText(txt);}
      else{const el=document.createElement("textarea");el.value=txt;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}
      setCopied(id);setTimeout(()=>setCopied(null),1500);
    }catch(e){flash("Copy failed: "+e.message);}
  };

  const loadAll=async()=>{
    setLoading(true);
    // Archive full days
    const fKeys=await stList(ARCHIVE_FULL_PREFIX);
    const fLoaded=[];
    for(const k of fKeys){const v=await stGet(k);if(v)fLoaded.push(v);}
    fLoaded.sort((a,b)=>a.date>b.date?-1:1);
    setFullList(fLoaded);

    // Archive per-tab
    const tKeys=await stList(ARCHIVE_TAB_PREFIX);
    const groups={};
    for(const k of tKeys){
      const v=await stGet(k);
      if(!v)continue;
      const tId=v.tab||k.replace(ARCHIVE_TAB_PREFIX,"").split("-")[0]||"unknown";
      (groups[tId]=groups[tId]||[]).push(v);
    }
    Object.keys(groups).forEach(tId=>groups[tId].sort((a,b)=>a.date>b.date?-1:1));
    setTabGroups(groups);

    // PDF archive
    const pKeys=await stList("pdffull-");
    const pLoaded=[];
    for(const k of pKeys){const v=await stGet(k);if(v&&!v.tab)pLoaded.push(v);}
    pLoaded.sort((a,b)=>a.date>b.date?-1:1);
    setPdfList(pLoaded);

    const ptKeys=await stList("pdftab-");
    const ptGroups={};
    for(const k of ptKeys){
      const v=await stGet(k);
      if(!v)continue;
      const tId=v.tab||k.replace("pdftab-","").split("-")[0]||"unknown";
      (ptGroups[tId]=ptGroups[tId]||[]).push(v);
    }
    Object.keys(ptGroups).forEach(tId=>ptGroups[tId].sort((a,b)=>a.date>b.date?-1:1));
    setPdfTabGroups(ptGroups);

    // Auto backups index
    const bIdx=await DataManager.getBackupIndex();
    setBackups(bIdx||[]);

    // Integrity check
    const issues=await DataManager.checkIntegrity();
    setIntegrity(issues||[]);

    // Meta
    const m=await DataManager.getMeta();
    setMeta(m);

    setLoading(false);
    dbg("loadAll complete");
  };
  useEffect(()=>{loadAll();},[]);

  const tabInfo=tId=>TABS.find(t=>t.id===tId)||{icon:"📁",label:tId};
  const currentTabInfo=tabInfo(tab);

  // ── Save operations ────────────────────────────────────────────────────
  const saveFullNow=async()=>{
    setSavingNow(true);
    const today=todayStr();
    const key=archiveFullKey(today);
    const meta2={date:today,savedAt:Date.now(),notes:saveNotes};
    await stSet(key,meta2);
    const check=await stGet(key);
    await timelineAdd({cat:"task",icon:"💾",label:"Day logged: "+today,detail:saveNotes||"—"});
    await loadAll();
    setSavingNow(false);setSaveNotes("");
    flash(check?"✓ Day logged":"❌ Write failed");
  };
  const saveTabNow=async()=>{
    setSavingNow(true);
    const today=todayStr();
    const key=archiveTabKey(tab,today);
    const meta2={date:today,tab,label:currentTabInfo.label,savedAt:Date.now(),notes:saveNotes};
    await stSet(key,meta2);
    await loadAll();
    setSavingNow(false);setSaveNotes("");
    flash(`✓ '${currentTabInfo.label}' logged`);
  };
  const savePdfNow=async()=>{
    setSavingNow(true);
    const today=todayStr();
    const html=buildFullExportHtml(data,EXPORT_TABS.map(t=>t.id));
    const uri="data:text/html;charset=utf-8,"+encodeURIComponent(html);
    await stSet("pdffull-"+today,{date:today,savedAt:Date.now(),name:`Atul_Life_OS_${today}.html`,data:uri,notes:pdfNotes});
    await loadAll();setSavingNow(false);setPdfNotes("");
    flash("✓ PDF link saved");
  };
  const savePdfTabNow=async()=>{
    setSavingNow(true);
    const today=todayStr();
    const html=buildFullExportHtml(data,[tab],currentTabInfo.label);
    const uri="data:text/html;charset=utf-8,"+encodeURIComponent(html);
    await stSet(`pdftab-${tab}-${today}`,{date:today,tab,savedAt:Date.now(),name:`Atul_${currentTabInfo.label.replace(/[^\w]+/g,"_")}_${today}.html`,data:uri,notes:pdfNotes});
    await loadAll();setSavingNow(false);setPdfNotes("");
    flash(`✓ '${currentTabInfo.label}' PDF saved`);
  };

  const doManualBackup=async()=>{
    setSavingNow(true);
    const id=await DataManager.manualBackup(data, manualBackupName||undefined);
    setSavingNow(false);setManualBackupName("");
    await loadAll();
    flash(id?"✅ Manual backup saved!":"❌ Backup failed");
    await timelineAdd({cat:"snapshot",icon:"💾",label:"Manual backup: "+(manualBackupName||"unnamed"),detail:id||"—"});
  };

  const doEmergencyBackup=async()=>{
    setSavingNow(true);
    const id=await DataManager.emergencyBackup(data,"User-triggered emergency");
    setSavingNow(false);
    await loadAll();
    flash(id?"🚨 Emergency backup saved!":"❌ Failed");
  };

  const openBackupDetail=async(bk)=>{
    const full=await DataManager.loadBackup(bk.key);
    setOpenBackup(bk);setOpenBackupData(full);
  };

  const doRestoreFromBackup=async()=>{
    if(!openBackupData?.data)return;
    setSavingNow(true);
    await DataManager.emergencyBackup(data,"Pre-restore safety backup");
    await restoreAll(openBackupData.data);
    setSavingNow(false);setOpenBackup(null);setOpenBackupData(null);setRestorePreview(null);
    flash("✅ Restored from backup!");
    await timelineAdd({cat:"snapshot",icon:"🔄",label:"Restored from backup: "+(openBackup?.label||"—"),detail:openBackup?.date||"—"});
  };

  const doRestoreAll=async(snap)=>{
    await DataManager.emergencyBackup(data,"Pre-restore safety");
    await restoreAll(snap.data);
    setConfirmKey(null);flash(`✓ Restored from ${snap.date}`);
  };
  const doRestoreTab=async(tId,snap)=>{
    await restoreTab(tId,snap.data);
    setConfirmKey(null);flash(`✓ Restored '${tabInfo(tId).label}'`);
  };

  const exportDatabase=async()=>{
    setSavingNow(true);
    try{
      const full=await DataManager.exportFull(data,"Full DB Export v41");
      const blob=new Blob([JSON.stringify(full,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`LifeOS_v41_Backup_${todayStr()}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
      await timelineAdd({cat:"snapshot",icon:"📤",label:"Full DB exported",detail:todayStr()});
    }catch(e){flash("Export failed: "+e.message);}
    setSavingNow(false);
  };

  const doImport=async()=>{
    if(!importText.trim()){flash("Paste JSON first");return;}
    setSavingNow(true);
    await DataManager.emergencyBackup(data,"Pre-import safety");
    const result=await DataManager.importData(importText);
    setSavingNow(false);
    if(result.ok){setImportMsg("✅ Import merged! Triple-backed.");setImportText("");}
    else setImportMsg("❌ Invalid JSON: "+result.error);
  };

  const delEntry=async(key)=>{await stDel(key);await loadAll();};

  // ── UI helpers ──────────────────────────────────────────────────────────
  const fmtTime=ts=>ts?new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
  const TH=({children,w})=>(<th style={{textAlign:"left",padding:"7px 8px",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",width:w||"auto"}}>{children}</th>);

  const DayRow=({item,keyStr,onRestore,onDelete,isCopied,onCopy})=>(
    <tr style={{borderBottom:`1px solid ${C.border}`}}>
      <td style={{padding:"9px 8px",color:C.gold,fontWeight:800,whiteSpace:"nowrap",fontSize:12}}>📅 {item.date}</td>
      <td style={{padding:"9px 8px",color:C.muted,fontSize:11,whiteSpace:"nowrap"}}>{fmtTime(item.savedAt)}</td>
      <td style={{padding:"9px 8px",color:C.text,fontSize:11,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.notes||<span style={{color:C.muted,fontStyle:"italic"}}>—</span>}</td>
      <td style={{padding:"9px 6px",whiteSpace:"nowrap"}}>
        <button onClick={onCopy} style={{background:isCopied?`${C.green}33`:"rgba(59,130,246,0.15)",border:`1px solid ${isCopied?C.green:C.blue}44`,color:isCopied?C.green:C.blue,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{isCopied?"✓":"📋"}</button>
      </td>
      <td style={{padding:"9px 6px",whiteSpace:"nowrap"}}>
        <button onClick={onRestore} style={{background:`${confirmKey===keyStr?C.saffron:"rgba(255,107,53,0.15)"}`,border:`1px solid ${C.saffron}44`,color:confirmKey===keyStr?"#000":C.saffron,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{confirmKey===keyStr?"⚠️ Confirm":"🔄"}</button>
      </td>
      <td style={{padding:"9px 6px"}}>
        <button onClick={onDelete} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:7,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button>
      </td>
    </tr>
  );

  const TableWrap=({children})=>(
    <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:480}}>
        <thead><tr><TH>Date</TH><TH>Saved At</TH><TH>Notes</TH><TH></TH><TH></TH><TH></TH></tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );

  const intColor={critical:C.red,warning:C.gold,info:C.blue};

  const VIEWS=[
    {id:"overview",  label:"🏗️ Architecture",  color:C.saffron},
    {id:"backup",    label:"💾 Backup Engine",  color:C.green},
    {id:"full",      label:"📚 Day Archive",    color:C.blue},
    {id:"tabs",      label:"📁 Tab Archive",    color:C.purple},
    {id:"pdf",       label:"📄 PDF Links",      color:C.gold},
    {id:"export",    label:"📤 Export/Import",  color:C.teal},
    {id:"recovery",  label:"🔄 Recovery",       color:C.pink},
  ];

  // ── Backup Detail View ──────────────────────────────────────────────────
  if(openBackup && openBackupData){
    return(
      <div>
        <button onClick={()=>{setOpenBackup(null);setOpenBackupData(null);setRestorePreview(null);}} style={{background:`${C.muted}20`,border:"none",borderRadius:8,padding:"8px 14px",color:C.muted,fontWeight:700,cursor:"pointer",marginBottom:12,fontSize:12}}>← Back</button>
        <Card glow={C.green}>
          <div style={{color:C.green,fontWeight:800,fontSize:14,marginBottom:4}}>💾 {openBackupData.label||openBackup.label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {[["📅",openBackupData.date],["🏷️",openBackupData.type],["📦",openBackupData.appVersion],["🔢","Schema v"+openBackupData.schemaVersion]].map(([ic,v],i)=>v&&(
              <div key={i} style={{background:"rgba(255,255,255,0.05)",borderRadius:6,padding:"3px 8px",fontSize:10,color:C.muted}}>{ic} {v}</div>
            ))}
          </div>
          <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Saved: {fmtTime(openBackupData.ts)}</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            <button onClick={()=>setRestorePreview(openBackupData)} style={{background:`${C.saffron}15`,border:`1px solid ${C.saffron}40`,borderRadius:8,padding:"8px 14px",color:C.saffron,fontWeight:700,cursor:"pointer",fontSize:12}}>🔄 Restore from This</button>
            <button onClick={()=>{const blob=new Blob([JSON.stringify(openBackupData,null,2)],{type:"application/json"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=`Backup_${openBackupData.type}_${openBackupData.date}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}} style={{background:`${C.blue}15`,border:`1px solid ${C.blue}40`,borderRadius:8,padding:"8px 14px",color:C.blue,fontWeight:700,cursor:"pointer",fontSize:12}}>📥 Download JSON</button>
          </div>
          {restorePreview&&(
            <div style={{marginTop:14,background:`${C.red}10`,border:`1px solid ${C.red}40`,borderRadius:10,padding:12}}>
              <div style={{color:C.red,fontWeight:800,fontSize:13,marginBottom:6}}>⚠️ Confirm Restore</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:10}}>This will replace your current data with the backup from {openBackupData.date}. A pre-restore emergency backup will be created automatically.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={doRestoreFromBackup} style={{background:C.red,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:800,cursor:"pointer",fontSize:12}}>{savingNow?"Restoring...":"✅ Yes, Restore"}</button>
                <button onClick={()=>setRestorePreview(null)} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"9px 14px",color:C.muted,cursor:"pointer",fontSize:12}}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{marginTop:12,color:C.muted,fontSize:10,marginBottom:6}}>DATA KEYS IN THIS BACKUP</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {Object.keys(openBackupData.data||{}).slice(0,40).map((k,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:5,padding:"2px 7px",fontSize:10,color:C.muted}}>{k}</div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return(
    <div>
      <SectionTitle icon="🗄️" title="Storage OS" sub="Production-grade permanent data architecture — v41"/>

      {toast&&<div style={{background:`${C.green}18`,border:`1px solid ${C.green}40`,borderRadius:8,padding:"8px 14px",color:C.green,fontSize:12,fontWeight:700,marginBottom:12}}>{toast}</div>}

      {/* INTEGRITY BANNER */}
      {integrity.filter(i=>i.level==="critical"||i.level==="warning").map((iss,i)=>(
        <div key={i} style={{background:`${intColor[iss.level]}12`,border:`1px solid ${intColor[iss.level]}40`,borderRadius:8,padding:"8px 14px",marginBottom:8,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:14}}>{iss.level==="critical"?"🚨":"⚠️"}</span>
          <span style={{color:intColor[iss.level],fontSize:12,fontWeight:700}}>{iss.msg}</span>
        </div>
      ))}

      {/* TAB NAV */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        {VIEWS.map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{padding:"7px 11px",borderRadius:9,border:`1px solid ${view===v.id?v.color:"rgba(255,255,255,0.1)"}`,background:view===v.id?`${v.color}20`:"transparent",color:view===v.id?v.color:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {v.label}
          </button>
        ))}
      </div>

      {loading&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:24}}>Loading storage data...</div>}

      {/* ── OVERVIEW / ARCHITECTURE ── */}
      {!loading&&view==="overview"&&(
        <div>
          {/* Architecture Diagram */}
          <Card glow={C.saffron}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:12}}>🏗️ Storage Architecture</div>
            <div style={{fontFamily:"monospace",fontSize:11,color:C.muted,lineHeight:2}}>
              {[
                {l:"UI (React State — cache only)",  c:C.text},
                {l:"      ↓",c:C.muted},
                {l:"StorageManager (DataManager v41)",c:C.saffron},
                {l:"      ↓",c:C.muted},
                {l:"Repository Layer (stGet/stSet/stList)",c:C.gold},
                {l:"      ↓",c:C.muted},
                {l:"Primary + Backup + Recovery Copies",c:C.green},
                {l:"      ↓",c:C.muted},
                {l:"Backup Engine (daily/weekly/monthly/emergency/manual)",c:C.blue},
                {l:"      ↓",c:C.muted},
                {l:"Snapshot Engine (daily auto + manual types)",c:C.purple},
                {l:"      ↓",c:C.muted},
                {l:"Timeline Engine (every action logged)",c:C.teal},
                {l:"      ↓",c:C.muted},
                {l:"Export Engine (JSON/HTML/PDF)",c:C.pink},
              ].map((row,i)=>(
                <div key={i} style={{color:row.c}}>{row.l}</div>
              ))}
            </div>
          </Card>

          {/* System Status */}
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:10}}>📊 System Status</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[
                {label:"App Version",  value:APP_VERSION,            color:C.saffron},
                {label:"Schema",       value:"v"+SCHEMA_VERSION,     color:C.gold},
                {label:"Last Boot",    value:meta?.lastBoot?new Date(meta.lastBoot).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—", color:C.blue},
                {label:"Boot Source",  value:meta?.source||"—",      color:C.green},
                {label:"Auto Backups", value:backups.length+" stored",color:C.teal},
                {label:"Archive Days", value:fullList.length+" days", color:C.purple},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:C.muted,fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>{s.label}</div>
                  <div style={{color:s.color,fontWeight:800,fontSize:13,marginTop:2}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Integrity report */}
            <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:6}}>INTEGRITY CHECK</div>
            {integrity.length===0&&<div style={{color:C.green,fontSize:12,fontWeight:700}}>✅ All systems healthy</div>}
            {integrity.map((iss,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:intColor[iss.level]||C.muted,fontSize:12}}>{iss.level==="critical"?"🚨":iss.level==="warning"?"⚠️":"ℹ️"}</span>
                <span style={{color:C.text,fontSize:11}}>{iss.msg}</span>
              </div>
            ))}
          </Card>

          {/* Quick Save Row */}
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:8}}>⚡ Quick Save</div>
            <textarea value={saveNotes} onChange={e=>setSaveNotes(e.target.value)} rows={2}
              placeholder="Notes for today's save (optional)"
              style={{...IS,marginBottom:10,resize:"vertical"}}/>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button onClick={saveFullNow} disabled={savingNow} style={{flex:1,minWidth:140,background:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#000",border:"none",borderRadius:10,padding:"11px 14px",fontWeight:800,fontSize:12,cursor:"pointer"}}>
                {savingNow?"Saving...":"💾 Save Day"}
              </button>
              <button onClick={saveTabNow} disabled={savingNow} style={{flex:1,minWidth:140,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"11px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                📌 Log Tab: "{currentTabInfo.label}"
              </button>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:7}}>
              <SaveSnapshotButton type="daily" label="Today" data={data} color={C.blue}/>
              <SaveSnapshotButton type="weekly" label="This Week" data={data} color={C.green}/>
              <SaveSnapshotButton type="monthly" label="This Month" data={data} color={C.gold}/>
              <SaveSnapshotButton type="custom" label="Custom Now" data={data} color={C.purple}/>
            </div>
          </Card>
        </div>
      )}

      {/* ── BACKUP ENGINE ── */}
      {!loading&&view==="backup"&&(
        <div>
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:4}}>💾 Backup Engine</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Auto backups run daily, weekly, and monthly on app boot. Never overwrite — every version is preserved forever.</div>

            {/* Manual backup */}
            <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:10,marginBottom:10}}>
              <div style={{color:C.teal,fontWeight:700,fontSize:11,marginBottom:6}}>📝 Save Manual Backup</div>
              <input value={manualBackupName} onChange={e=>setManualBackupName(e.target.value)} placeholder="Backup label (optional)" style={{...IS,marginBottom:8}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={doManualBackup} disabled={savingNow} style={{flex:1,background:C.green,color:"#000",border:"none",borderRadius:8,padding:"10px",fontWeight:800,cursor:"pointer",fontSize:12}}>{savingNow?"Saving...":"💾 Save Manual Backup"}</button>
                <button onClick={doEmergencyBackup} disabled={savingNow} style={{flex:1,background:`${C.red}20`,border:`1px solid ${C.red}40`,color:C.red,borderRadius:8,padding:"10px",fontWeight:800,cursor:"pointer",fontSize:12}}>🚨 Emergency Backup</button>
              </div>
            </div>
          </Card>

          {/* Backup list */}
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:8}}>📋 Backup History ({backups.length})</div>
            {backups.length===0&&<div style={{color:C.muted,fontSize:12}}>No auto backups yet. They run automatically on app boot.</div>}
            {backups.map((bk,i)=>{
              const tc={daily:C.blue,weekly:C.green,monthly:C.gold,emergency:C.red,manual:C.teal}[bk.type]||C.muted;
              return(
                <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:34,height:34,borderRadius:8,background:`${tc}18`,border:`1px solid ${tc}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                    {{daily:"📅",weekly:"🗓️",monthly:"📆",emergency:"🚨",manual:"📝"}[bk.type]||"💾"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bk.label||bk.backupId}</div>
                    <div style={{color:C.muted,fontSize:10,marginTop:1}}>{bk.date} · {fmtTime(bk.ts)}</div>
                  </div>
                  <div style={{flexShrink:0,display:"flex",gap:5}}>
                    <div style={{background:`${tc}15`,borderRadius:6,padding:"2px 7px"}}><span style={{color:tc,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{bk.type}</span></div>
                    <button onClick={()=>openBackupDetail(bk)} style={{background:`${C.blue}15`,border:`1px solid ${C.blue}30`,borderRadius:6,padding:"4px 9px",color:C.blue,fontSize:10,fontWeight:700,cursor:"pointer"}}>Open</button>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* ── FULL DAY ARCHIVE ── */}
      {!loading&&view==="full"&&(
        <div>
          <Card glow={C.saffron}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:8}}>💾 Save Today's Entry</div>
            <textarea value={saveNotes} onChange={e=>setSaveNotes(e.target.value)} rows={2}
              placeholder="What did you work on today? (optional)" style={{...IS,marginBottom:10,resize:"vertical"}}/>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button onClick={saveFullNow} disabled={savingNow} style={{flex:1,minWidth:140,background:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#000",border:"none",borderRadius:10,padding:"11px",fontWeight:800,fontSize:12,cursor:"pointer"}}>{savingNow?"Saving...":"💾 Save Today"}</button>
              <button onClick={saveTabNow} disabled={savingNow} style={{flex:1,minWidth:140,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,cursor:"pointer"}}>📌 Log Tab: "{currentTabInfo.label}"</button>
            </div>
          </Card>
          <Card>
            <div style={{color:C.text,fontWeight:700,fontSize:13,marginBottom:10}}>📚 All-Day Logs ({fullList.length})</div>
            {fullList.length===0?(
              <div style={{color:C.muted,fontSize:12,padding:"12px 0"}}>No entries yet — add a note above and tap "💾 Save Today".</div>
            ):(
              <TableWrap>
                {fullList.map(item=>{
                  const k=archiveFullKey(item.date);
                  const summary=`Atul Life OS ✅\nDate: ${item.date}\nSaved: ${fmtTime(item.savedAt)}\nNotes: ${item.notes||"—"}`;
                  return(
                    <DayRow key={k} item={item} keyStr={k}
                      isCopied={copied===k}
                      onCopy={()=>copyText(summary,k)}
                      onRestore={()=>confirmKey===k?doRestoreAll(item):setConfirmKey(k)}
                      onDelete={()=>delEntry(k)}
                    />
                  );
                })}
              </TableWrap>
            )}
          </Card>
        </div>
      )}

      {/* ── PER-TAB ARCHIVE ── */}
      {!loading&&view==="tabs"&&(
        <div>
          {Object.keys(tabGroups).length===0&&(
            <Card><div style={{color:C.muted,fontSize:12}}>No per-tab logs yet. Open any tab and use "📌 Log Tab".</div></Card>
          )}
          {Object.keys(tabGroups).sort().map(tId=>{
            const info=tabInfo(tId);
            return(
              <Card key={tId}>
                <div style={{color:C.text,fontWeight:800,fontSize:13,marginBottom:10}}>
                  {info.icon} {info.label}
                  <span style={{color:C.muted,fontWeight:400,fontSize:11,marginLeft:6}}>({tabGroups[tId].length} entries)</span>
                </div>
                <TableWrap>
                  {tabGroups[tId].map(item=>{
                    const k=archiveTabKey(tId,item.date);
                    const summary=`Atul Life OS — ${info.label} ✅\nDate: ${item.date}\nSaved: ${fmtTime(item.savedAt)}\nNotes: ${item.notes||"—"}`;
                    return(
                      <DayRow key={k} item={item} keyStr={k}
                        isCopied={copied===k}
                        onCopy={()=>copyText(summary,k)}
                        onRestore={()=>confirmKey===k?doRestoreTab(tId,item):setConfirmKey(k)}
                        onDelete={()=>delEntry(k)}
                      />
                    );
                  })}
                </TableWrap>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── PDF LINKS ── */}
      {!loading&&view==="pdf"&&(
        <div>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:6}}>📄 Save PDF Links</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:8}}>🔗 Open downloads the HTML file. In Chrome: ⋮ → Print → Save as PDF.</div>
            <textarea value={pdfNotes} onChange={e=>setPdfNotes(e.target.value)} rows={2} placeholder="PDF notes (optional)" style={{...IS,marginBottom:8,resize:"vertical"}}/>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button onClick={savePdfNow} disabled={savingNow} style={{flex:1,minWidth:140,background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:800,fontSize:12,cursor:"pointer"}}>📄 Full Life OS PDF</button>
              <button onClick={savePdfTabNow} disabled={savingNow} style={{flex:1,minWidth:140,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"11px",fontWeight:700,fontSize:12,cursor:"pointer"}}>📄 PDF — "{currentTabInfo.label}"</button>
            </div>
          </Card>
          {pdfList.length>0&&(
            <Card>
              <div style={{color:C.text,fontWeight:700,fontSize:13,marginBottom:6}}>📄 Full-Day PDF Links ({pdfList.length})</div>
              <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:500}}>
                  <thead><tr><TH>Date</TH><TH>Saved At</TH><TH>Notes</TH><TH>Open</TH><TH>Copy</TH><TH></TH></tr></thead>
                  <tbody>
                    {pdfList.map(item=>(
                      <tr key={item.date} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:"9px 8px",color:C.gold,fontWeight:800,whiteSpace:"nowrap"}}>{item.date}</td>
                        <td style={{padding:"9px 8px",color:C.muted,fontSize:11,whiteSpace:"nowrap"}}>{fmtTime(item.savedAt)}</td>
                        <td style={{padding:"9px 8px",color:C.text,fontSize:11}}>{item.notes||<span style={{color:C.muted,fontStyle:"italic"}}>—</span>}</td>
                        <td style={{padding:"9px 6px"}}><a href={item.data} download={item.name} target="_blank" rel="noopener noreferrer" style={{background:"rgba(59,130,246,0.15)",border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,textDecoration:"none",display:"inline-block"}}>🔗 Open</a></td>
                        <td style={{padding:"9px 6px"}}><button onClick={()=>copyText(item.data,"pdf-"+item.date)} style={{background:copied==="pdf-"+item.date?`${C.green}33`:"rgba(59,130,246,0.15)",border:`1px solid ${copied==="pdf-"+item.date?C.green:C.blue}44`,color:copied==="pdf-"+item.date?C.green:C.blue,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{copied==="pdf-"+item.date?"✓":"📋"}</button></td>
                        <td style={{padding:"9px 6px"}}><button onClick={()=>delEntry("pdffull-"+item.date)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:7,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {Object.keys(pdfTabGroups).length>0&&Object.keys(pdfTabGroups).sort().map(tId=>{
            const info=tabInfo(tId);
            return(
              <Card key={tId}>
                <div style={{color:C.text,fontWeight:800,fontSize:13,marginBottom:10}}>{info.icon} {info.label} <span style={{color:C.muted,fontWeight:400,fontSize:11}}>— PDF links ({pdfTabGroups[tId].length})</span></div>
                <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:500}}>
                    <thead><tr><TH>Date</TH><TH>Saved At</TH><TH>Notes</TH><TH>Open</TH><TH>Copy</TH><TH></TH></tr></thead>
                    <tbody>
                      {pdfTabGroups[tId].map(item=>(
                        <tr key={item.date} style={{borderBottom:`1px solid ${C.border}`}}>
                          <td style={{padding:"9px 8px",color:C.gold,fontWeight:800,whiteSpace:"nowrap"}}>{item.date}</td>
                          <td style={{padding:"9px 8px",color:C.muted,fontSize:11,whiteSpace:"nowrap"}}>{fmtTime(item.savedAt)}</td>
                          <td style={{padding:"9px 8px",color:C.text,fontSize:11}}>{item.notes||<span style={{color:C.muted,fontStyle:"italic"}}>—</span>}</td>
                          <td style={{padding:"9px 6px"}}><a href={item.data} download={item.name} target="_blank" rel="noopener noreferrer" style={{background:"rgba(59,130,246,0.15)",border:`1px solid ${C.blue}44`,color:C.blue,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,textDecoration:"none",display:"inline-block"}}>🔗 Open</a></td>
                          <td style={{padding:"9px 6px"}}>{(()=>{const ptk="pdftab-"+tId+"-"+item.date;const isc=copied===ptk;return(<button onClick={()=>copyText(item.data,ptk)} style={{background:isc?`${C.green}33`:"rgba(59,130,246,0.15)",border:"1px solid "+(isc?C.green:C.blue)+"44",color:isc?C.green:C.blue,borderRadius:7,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{isc?"✓":"📋"}</button>);})()}</td>
                          <td style={{padding:"9px 6px"}}><button onClick={()=>delEntry(`pdftab-${tId}-${item.date}`)} style={{background:"rgba(239,68,68,0.15)",border:"none",color:C.red,borderRadius:7,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── EXPORT / IMPORT ── */}
      {!loading&&view==="export"&&(
        <div>
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:8}}>📤 Export Full Database</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Exports entire Life OS — all keys, all modules, all data. Always exports from the latest live database.</div>
            <button onClick={exportDatabase} disabled={savingNow} style={{background:C.green,color:"#000",border:"none",borderRadius:8,padding:"11px 18px",fontWeight:800,cursor:"pointer",fontSize:12,width:"100%"}}>{savingNow?"Exporting...":"⬇️ Download Full DB Backup (JSON)"}</button>
          </Card>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:6}}>📄 Export as PDF / HTML</div>
            <textarea value={pdfNotes} onChange={e=>setPdfNotes(e.target.value)} rows={2} placeholder="Notes (optional)" style={{...IS,marginBottom:8,resize:"vertical"}}/>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button onClick={savePdfNow} disabled={savingNow} style={{flex:1,background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:800,fontSize:12,cursor:"pointer"}}>📄 Full Life OS</button>
              <button onClick={savePdfTabNow} disabled={savingNow} style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"10px",fontWeight:700,fontSize:12,cursor:"pointer"}}>📄 Current Tab Only</button>
            </div>
          </Card>
          <Card glow={C.saffron}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:6}}>📥 Import / Merge Backup</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:8}}>Paste a JSON backup. Your existing data is NEVER deleted — import only fills gaps (existing values take priority).</div>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} style={{...IS,minHeight:80,resize:"vertical"}} placeholder="Paste JSON backup here..."/>
            <button onClick={doImport} disabled={savingNow} style={{background:C.saffron,color:"#000",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:800,cursor:"pointer",fontSize:12,marginTop:8,width:"100%"}}>{savingNow?"Importing...":"📥 Import & Merge"}</button>
            {importMsg&&<div style={{color:importMsg.startsWith("✅")?C.green:C.red,fontSize:12,marginTop:8,fontWeight:700}}>{importMsg}</div>}
          </Card>
        </div>
      )}

      {/* ── RECOVERY ENGINE ── */}
      {!loading&&view==="recovery"&&(
        <div>
          <Card glow={C.pink}>
            <div style={{color:C.pink,fontWeight:800,fontSize:13,marginBottom:8}}>🔄 Recovery Engine</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Every write creates 3 copies (primary + backup + recovery). Use these options to recover lost or corrupted data.</div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {label:"🔄 Restore from Latest Backup",detail:"Loads the most recent auto-backup from the Backup Engine",color:C.green,action:async()=>{const idx=await DataManager.getBackupIndex();if(idx.length>0){const bk=idx[0];const full=await DataManager.loadBackup(bk.key);if(full?.data){await DataManager.emergencyBackup(data,"Pre-recovery safety");await restoreAll(full.data);flash("✅ Restored from: "+bk.label);await timelineAdd({cat:"snapshot",icon:"🔄",label:"Recovery: restored from "+bk.label,detail:bk.date});}}else{flash("No backups found");}await loadAll();}},
                {label:"🛡️ Force Triple Re-write",detail:"Re-saves current data to all 3 storage copies to fix any corruption",color:C.blue,action:async()=>{setSavingNow(true);await DataManager.save(data);setSavingNow(false);flash("✅ Triple re-write complete");}},
                {label:"🚨 Create Emergency Backup Now",detail:"Immediately saves a timestamped emergency backup — use before any risky change",color:C.red,action:async()=>{setSavingNow(true);const id=await DataManager.emergencyBackup(data,"Manual emergency trigger");setSavingNow(false);await loadAll();flash(id?"🚨 Emergency backup saved: "+id:"❌ Failed");}},
              ].map((op,i)=>(
                <button key={i} onClick={op.action} disabled={savingNow} style={{background:`${op.color}10`,border:`1px solid ${op.color}30`,borderRadius:12,padding:"13px 14px",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
                  <div style={{color:op.color,fontWeight:800,fontSize:13}}>{op.label}</div>
                  <div style={{color:C.muted,fontSize:11,marginTop:3}}>{op.detail}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card glow={C.teal}>
            <div style={{color:C.teal,fontWeight:800,fontSize:13,marginBottom:8}}>📋 Recovery Principles</div>
            {[
              ["Zero Data Loss","Every save writes to Primary + Backup + Recovery simultaneously"],
              ["No Crash Loss","Write queue serialises all saves — no concurrent write conflicts"],
              ["No Update Loss","Schema migrations auto-run on boot, existing data preserved"],
              ["Verify on Write","Every write is read back and verified before confirming success"],
              ["Backup Index","All auto backups are indexed with keys — fully browsable and restorable"],
              ["Timeline Log","Every action is timestamped — full audit trail of all changes"],
            ].map(([title,detail],i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green,fontSize:11,flexShrink:0,marginTop:1}}>✓</span>
                <div>
                  <div style={{color:C.text,fontSize:12,fontWeight:700}}>{title}</div>
                  <div style={{color:C.muted,fontSize:11,marginTop:1}}>{detail}</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Debug log */}
          {debugLog.length>0&&(
            <Card>
              <div style={{color:C.muted,fontWeight:700,fontSize:10,letterSpacing:1,marginBottom:6}}>DEBUG LOG</div>
              {debugLog.map((l,i)=><div key={i} style={{color:C.muted,fontSize:10,padding:"2px 0"}}>{l}</div>)}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QUICK REF TAB (from Offline HTML — fast access summary) ─────────────────
function QuickRefTab(){
  const{data}=useEC();
  const[isOnline,setIsOnline]=useState(navigator.onLine);
  useEffect(()=>{
    const on=()=>setIsOnline(true);
    const off=()=>setIsOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);

  const QCard=({icon,title,children,col})=>(
    <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${col||C.border}`,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{color:col||C.gold,fontWeight:800,fontSize:13,marginBottom:10}}>{icon} {title}</div>
      {children}
    </div>
  );
  const Row=({label,val,col})=>(
    <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
      <span style={{color:C.muted,fontSize:12}}>{label}</span>
      <span style={{color:col||C.text,fontSize:12,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{val}</span>
    </div>
  );

  return(
    <div>
      <SectionTitle icon="📋" title="Quick Reference" sub="Ek nazar vich sab — offline vee kaam karda hai!"/>

      {/* Online/Offline Status */}
      <div style={{background:isOnline?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${isOnline?C.green:C.red}44`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:isOnline?C.green:C.red,flexShrink:0}}/>
        <span style={{color:isOnline?C.green:C.red,fontWeight:700,fontSize:12}}>{isOnline?"🟢 Online — all features active":"🔴 Offline — reading saved data only"}</span>
      </div>

      {/* TODAY'S KEY TIMES */}
      <QCard icon="⏰" title="TODAY'S KEY TIMES" col={C.purple}>
        {[
          ["Wake Up","3:00 AM"],
          ["Study Block 1","3:27–4:35 AM"],
          ["Bath + Leave","5:05–5:35 AM"],
          ["CM Yogshala","5:35–2:00 PM"],
          ["Nap (Yoga Nidra)","2:30–4:00 PM"],
          ["Study Block 2","4:30–7:30 PM"],
          ["Dinner + Plan","8:30–9:10 PM"],
          ["Sleep","9:30 PM"],
        ].map(([l,v],i)=><Row key={i} label={l} val={v} col={C.saffron}/>)}
      </QCard>

      {/* IDENTITY QUICK VIEW */}
      <QCard icon="👑" title="IDENTITY CORE" col={C.saffron}>
        <div style={{color:C.text,fontSize:13,lineHeight:1.8,whiteSpace:"pre-line"}}>{(data.identityStatement||"").split("\n").slice(0,4).join("\n")}</div>
      </QCard>

      {/* MORNING CHECKLIST */}
      <QCard icon="✅" title="MORNING RITUAL CHECKLIST" col={C.green}>
        {["💧 2 Glasses Water","🙏 Nishkam Karma (3:02)","🏃 Running (3:07)","🧘 Meditation + Breathing (3:15)","📖 5 Breaths + Sankalp (3:25)","📚 Study Block 1 START (3:27)"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"4px 0",color:C.text,fontSize:12}}>
            <span style={{color:C.green,fontSize:10,marginTop:2}}>▶</span><span>{item}</span>
          </div>
        ))}
      </QCard>

      {/* SUBJECT ALLOCATION QUICK */}
      <QCard icon="📚" title="TODAY'S SUBJECT PLAN" col={C.blue}>
        {(data.subjectAlloc||[]).map((s,i)=><Row key={i} label={s.label} val={s.time} col={s.color||C.muted}/>)}
      </QCard>

      {/* DIET QUICK */}
      <QCard icon="🍽️" title="DIET PLAN" col={C.teal}>
        {(data.diet||[]).map((m,i)=><Row key={i} label={`${m.icon} ${m.meal}`} val={m.food}/>)}
      </QCard>

      {/* GOLDEN QUESTIONS */}
      <QCard icon="🌙" title="GOLDEN QUESTIONS (9 PM)" col={C.gold}>
        {(data.goldenQuestions||[]).map((q,i)=>(
          <div key={i} style={{color:C.text,fontSize:13,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>{i+1}. {q}</div>
        ))}
      </QCard>

      {/* MONEY JARS QUICK */}
      <QCard icon="🫙" title="MONTHLY JAR SYSTEM" col={C.pink}>
        {(data.moneyJars||[]).map((j,i)=><Row key={i} label={j.jar} val={`${j.amount} — ${j.rule}`} col={j.color||C.muted}/>)}
      </QCard>

      {/* EMERGENCY MINIMUM */}
      <QCard icon="🚨" title="EMERGENCY MIN (Bad Day Protocol)" col={C.red}>
        {["20 MCQs (any subject)","10 Min Anki review","Meditation 5 min","Sleep on time"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"3px 0",color:C.text,fontSize:12}}>
            <span style={{color:C.red}}>⚡</span><span>{item}</span>
          </div>
        ))}
        <div style={{marginTop:10,color:C.red,fontWeight:800,fontSize:12,textAlign:"center"}}>Never Miss Twice! 💪</div>
      </QCard>

      {/* PWA INSTALL HINT */}
      <div style={{background:"rgba(59,130,246,0.08)",border:`1px solid ${C.blue}33`,borderRadius:10,padding:12,textAlign:"center"}}>
        <div style={{color:C.blue,fontWeight:700,fontSize:12,marginBottom:4}}>📱 Home Screen pe Add karo</div>
        <div style={{color:C.muted,fontSize:11}}>Chrome → ⋮ → "Add to Home screen" → Offline vee chalega!</div>
      </div>
    </div>
  );
}


// ─── COMMAND CENTER TAB (v25 Home) ───────────────────────────────────────────
function CommandCenterTab(){
  const{data,set}=useEC();
  const[today,setToday]=useState({});
  const[checklist,setChecklist]=useState({});
  const[scoreData,setScoreData]=useState(null);
  const[streakDays,setStreakDays]=useState(0);
  const[pendingTasks,setPendingTasks]=useState([]);
  const[newTask,setNewTask]=useState("");
  const[tab2,setTab2]=useState("overview");

  const loadAll=async()=>{
    const td=await stGet("cmd-today:"+todayStr());
    if(td)setToday(td);
    const cl=await stGet("cmd-checklist:"+todayStr());
    if(cl)setChecklist(cl);
    const sc=await stGet("scorecard:"+todayKey());
    if(sc)setScoreData(sc);
    // streak
    const sh=(await stGet("streak-history"))||[];
    let streak=0;
    const sorted=[...sh].sort((a,b)=>b.date>a.date?1:-1);
    for(const d of sorted){if(d.pct>=50)streak++;else break;}
    setStreakDays(streak);
    const pt=(await stGet("cmd-pending"))||[];
    setPendingTasks(pt);
  };
  useEffect(()=>{loadAll();},[]);

  const saveToday=async(updated)=>{
    const n={...today,...updated};
    setToday(n);
    await stSet("cmd-today:"+todayStr(),n);
  };
  const saveChecklist=async(updated)=>{
    setChecklist(updated);
    await stSet("cmd-checklist:"+todayStr(),updated);
  };
  const savePending=async(list)=>{
    setPendingTasks(list);
    await stSet("cmd-pending",list);
  };

  const examDate=data.examDate?new Date(data.examDate):null;
  const daysLeft=examDate?Math.max(0,Math.ceil((examDate-new Date())/(86400000))):null;
  const isEmergency=daysLeft!==null&&daysLeft<=30;

  const checkItems=["🧘 Morning Meditation","🏃 Running","📚 Study Block 1","💧 Water 3-4L","🌾 Agriculture MCQs","📊 Quant MCQs","📿 Geeta Page","🌙 Night Meditation","📖 Anki Cards","📝 Journal"];
  const doneCount=checkItems.filter((_,i)=>checklist["c"+i]).length;

  const score=scoreData?scoreData.pct:null;
  const scoreColor=score===null?C.muted:score>=70?C.green:score>=40?C.gold:C.red;

  const Metric=({icon,label,value,color,onClick})=>(
    <div onClick={onClick} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${color||C.border}`,borderRadius:14,padding:"14px 12px",textAlign:"center",cursor:onClick?"pointer":"default"}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{color:color||C.text,fontWeight:900,fontSize:18,marginTop:4}}>{value}</div>
      <div style={{color:C.muted,fontSize:10,marginTop:2}}>{label}</div>
    </div>
  );

  return(
    <div>
      <SectionTitle icon="🚀" title="Command Center" sub={new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}/>

      {isEmergency&&(
        <div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.2),rgba(255,107,53,0.1))",border:`2px solid ${C.red}`,borderRadius:14,padding:"12px 16px",marginBottom:16,textAlign:"center"}}>
          <div style={{color:C.red,fontWeight:900,fontSize:16}}>🚨 EMERGENCY MODE — {daysLeft} DAYS LEFT!</div>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>Last 30 days. Full throttle. No shortcuts.</div>
        </div>
      )}

      {/* METRICS GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        <Metric icon="🏆" label="Today's Score" value={score!==null?score+"%":"—"} color={scoreColor}/>
        <Metric icon="🔥" label="Study Streak" value={streakDays+"d"} color={C.saffron}/>
        <Metric icon="📅" label="Days Left" value={daysLeft!==null?daysLeft:"Set Date"} color={isEmergency?C.red:C.blue}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        <Metric icon="💧" label="Water (L)" value={today.water||"0"} color={C.teal}/>
        <Metric icon="📚" label="Study Hrs" value={today.studyHrs||"0"} color={C.green}/>
        <Metric icon="🎯" label="MCQs Done" value={today.mcqs||"0"} color={C.gold}/>
      </div>

      {/* CHECKLIST PROGRESS */}
      <Card glow={C.green}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:C.green,fontWeight:800,fontSize:13}}>✅ Daily Checklist ({doneCount}/{checkItems.length})</div>
          <div style={{color:C.muted,fontSize:11}}>{Math.round(doneCount/checkItems.length*100)}%</div>
        </div>
        <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,marginBottom:12,overflow:"hidden"}}>
          <div style={{height:"100%",width:(doneCount/checkItems.length*100)+"%",background:`linear-gradient(90deg,${C.green},${C.teal})`,transition:"width 0.5s",borderRadius:3}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {checkItems.map((item,i)=>(
            <div key={i} onClick={()=>saveChecklist({...checklist,["c"+i]:!checklist["c"+i]})} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 8px",borderRadius:8,cursor:"pointer",background:checklist["c"+i]?"rgba(16,185,129,0.1)":"transparent"}}>
              <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${checklist["c"+i]?C.green:C.border}`,background:checklist["c"+i]?C.green:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {checklist["c"+i]&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
              </div>
              <span style={{color:checklist["c"+i]?C.green:C.muted,fontSize:11,textDecoration:checklist["c"+i]?"line-through":"none"}}>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ONE TASK TODAY */}
      <Card glow={C.saffron}>
        <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:8}}>🎯 TODAY'S ONE TASK</div>
        <input value={today.oneTask||""} onChange={e=>saveToday({oneTask:e.target.value})} style={{...IS,fontSize:15,fontWeight:700,color:C.text}} placeholder="Enter today's single most important task..."/>
        {today.oneTask&&(
          <div style={{marginTop:10,display:"flex",gap:10,alignItems:"center"}}>
            <div onClick={()=>saveToday({oneTaskDone:!today.oneTaskDone})} style={{width:24,height:24,borderRadius:6,border:`2px solid ${today.oneTaskDone?C.green:C.saffron}`,background:today.oneTaskDone?C.green:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {today.oneTaskDone&&<span style={{color:"#fff",fontWeight:900}}>✓</span>}
            </div>
            <span style={{color:today.oneTaskDone?C.green:C.muted,fontSize:13,textDecoration:today.oneTaskDone?"line-through":"none"}}>{today.oneTask}</span>
          </div>
        )}
      </Card>

      {/* DAILY NUMBERS */}
      <Card>
        <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>📊 Today's Numbers</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[["💧","Water (L)","water"],["📚","Study Hrs","studyHrs"],["🎯","MCQs","mcqs"]].map(([ic,lb,key])=>(
            <div key={key} style={{textAlign:"center"}}>
              <div style={{fontSize:18}}>{ic}</div>
              <input type="number" min="0" value={today[key]||""} onChange={e=>saveToday({[key]:e.target.value})} style={{...IS,textAlign:"center",fontSize:18,fontWeight:800,padding:"8px 4px",marginTop:4}} placeholder="0"/>
              <div style={{color:C.muted,fontSize:10,marginTop:2}}>{lb}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* PENDING TASKS */}
      <Card glow={C.purple}>
        <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:10}}>📋 Pending Tasks</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newTask.trim()){const updated=[...pendingTasks,{id:Date.now(),text:newTask.trim(),done:false}];savePending(updated);setNewTask("");}}} style={{...IS,flex:1}} placeholder="Add pending task... (Enter)"/>
          <button onClick={()=>{if(newTask.trim()){const updated=[...pendingTasks,{id:Date.now(),text:newTask.trim(),done:false}];savePending(updated);setNewTask("");}}} style={{background:C.purple,color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontWeight:800,cursor:"pointer",fontSize:13}}>+</button>
        </div>
        {pendingTasks.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No pending tasks 🎉</div>}
        {pendingTasks.map((t,i)=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
            <div onClick={()=>savePending(pendingTasks.map((p,j)=>j===i?{...p,done:!p.done}:p))} style={{width:18,height:18,borderRadius:4,border:`2px solid ${t.done?C.green:C.border}`,background:t.done?C.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {t.done&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
            </div>
            <span style={{flex:1,color:t.done?C.muted:C.text,fontSize:12,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
            <button onClick={()=>savePending(pendingTasks.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
          </div>
        ))}
        {pendingTasks.some(t=>t.done)&&<button onClick={()=>savePending(pendingTasks.filter(t=>!t.done))} style={{marginTop:10,background:"rgba(239,68,68,0.1)",border:`1px solid ${C.red}33`,color:C.red,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Clear Completed</button>}
      </Card>

      {/* QUICK ACTIONS */}
      <Card>
        <div style={{color:C.muted,fontWeight:800,fontSize:12,marginBottom:10,letterSpacing:1}}>⚡ QUICK ACTIONS</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["🍅","Start Pomodoro","pomodoro"],["⏳","Exam Countdown","countdown"],["🔒","Lock ONE Task","onetask"],["🏆","Score Today","scorecard"]].map(([ic,lb,tabId])=>(
            <div key={tabId} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 10px",textAlign:"center",cursor:"pointer"}} onClick={()=>{const ec=document.querySelector(`button[data-tab="${tabId}"]`);if(ec)ec.click();}}>
              <div style={{fontSize:22}}>{ic}</div>
              <div style={{color:C.muted,fontSize:11,marginTop:4}}>{lb}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── SMART EXAM COUNTDOWN TAB (v25) ───────────────────────────────────────────
function SmartCountdownTab(){
  const{data,set}=useEC();
  const[now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);

  const examDate=data.examDate?new Date(data.examDate):null;
  const daysLeft=examDate?Math.max(0,Math.ceil((examDate-now)/86400000)):null;
  const totalDays=data.examTotalDays||120;
  const pct=daysLeft!==null?Math.round((1-daysLeft/totalDays)*100):0;

  const isEmergency=daysLeft!==null&&daysLeft<=30;
  const urgencyColor=daysLeft===null?C.muted:daysLeft<=15?C.red:daysLeft<=30?"#FF6B35":daysLeft<=60?C.gold:C.green;

  const dailyMCQTarget=data.dailyMCQTarget||50;
  const dailyStudyHrs=data.dailyStudyHrsTarget||6;

  const subjectPriority=data.subjectPriority||[
    {name:"🌾 Agriculture",priority:1,color:C.green},
    {name:"📊 Quant",priority:2,color:C.gold},
    {name:"🏛️ Punjab GK",priority:3,color:C.purple},
    {name:"🧩 Reasoning",priority:4,color:C.blue},
    {name:"📖 English",priority:5,color:C.pink},
    {name:"💻 Computer",priority:6,color:C.saffron},
  ];

  return(
    <div>
      <SectionTitle icon="⏳" title="Smart Exam Countdown" sub={data.examName||"ADO / Patwari / AFO"}/>

      {/* BIG COUNTDOWN */}
      <Card glow={urgencyColor} style={{background:`linear-gradient(135deg,${urgencyColor}15,rgba(0,0,0,0))`,textAlign:"center",padding:"28px 20px"}}>
        {isEmergency&&<div style={{color:C.red,fontWeight:900,fontSize:12,letterSpacing:2,marginBottom:8}}>🚨 EMERGENCY MODE ACTIVE</div>}
        <div style={{fontSize:72,fontWeight:900,color:urgencyColor,textShadow:`0 0 40px ${urgencyColor}50`,lineHeight:1}}>{daysLeft!==null?daysLeft:"?"}</div>
        <div style={{color:C.muted,fontSize:14,marginTop:4,letterSpacing:2,fontWeight:700}}>DAYS LEFT</div>
        {examDate&&<div style={{color:C.muted,fontSize:12,marginTop:8}}>📅 {examDate.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>}
        {daysLeft!==null&&(
          <div style={{marginTop:16}}>
            <div style={{height:8,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden",maxWidth:300,margin:"0 auto"}}>
              <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${urgencyColor},${C.teal})`,transition:"width 1s",borderRadius:4}}/>
            </div>
            <div style={{color:C.muted,fontSize:11,marginTop:6}}>{pct}% preparation journey complete</div>
          </div>
        )}
      </Card>

      {/* EXAM DATE SETUP */}
      <Card>
        <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>📅 Exam Settings</div>
        <div style={{display:"grid",gap:10}}>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Exam Name</div>
            <input value={data.examName||""} onChange={e=>set("examName",e.target.value)} style={IS} placeholder="e.g. ADO / Patwari / AFO"/>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Exam Date</div>
            <input type="date" value={data.examDate||""} onChange={e=>set("examDate",e.target.value)} style={IS}/>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Total Prep Days (from start)</div>
            <input type="number" value={data.examTotalDays||120} onChange={e=>set("examTotalDays",Number(e.target.value))} style={IS} placeholder="120"/>
          </div>
        </div>
      </Card>

      {/* DAILY TARGETS */}
      <Card glow={C.saffron}>
        <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:12}}>🎯 Daily Targets</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Daily MCQ Target</div>
            <input type="number" value={data.dailyMCQTarget||50} onChange={e=>set("dailyMCQTarget",Number(e.target.value))} style={{...IS,fontSize:20,fontWeight:800,textAlign:"center"}}/>
            <div style={{color:C.muted,fontSize:10,marginTop:2,textAlign:"center"}}>MCQs / day</div>
          </div>
          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Daily Study Hours</div>
            <input type="number" value={data.dailyStudyHrsTarget||6} onChange={e=>set("dailyStudyHrsTarget",Number(e.target.value))} style={{...IS,fontSize:20,fontWeight:800,textAlign:"center"}}/>
            <div style={{color:C.muted,fontSize:10,marginTop:2,textAlign:"center"}}>hours / day</div>
          </div>
        </div>
        {daysLeft!==null&&(
          <div style={{marginTop:12,padding:"10px 12px",background:"rgba(0,0,0,0.2)",borderRadius:10}}>
            <div style={{color:C.muted,fontSize:11,marginBottom:4}}>📊 Remaining Targets</div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:C.text,fontSize:13}}>{(dailyMCQTarget*daysLeft).toLocaleString()} MCQs to go</span>
              <span style={{color:C.text,fontSize:13}}>{dailyStudyHrs*daysLeft}h study to go</span>
            </div>
          </div>
        )}
      </Card>

      {/* SUBJECT PRIORITY */}
      <Card glow={C.blue}>
        <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:12}}>🏆 Subject Priority Order</div>
        {subjectPriority.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{width:28,height:28,borderRadius:8,background:s.color+"22",border:`2px solid ${s.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:s.color,fontSize:14,flexShrink:0}}>{i+1}</div>
            <span style={{color:C.text,fontSize:13,flex:1}}>{s.name}</span>
            {isEmergency&&i===0&&<span style={{color:C.red,fontSize:10,fontWeight:800,background:"rgba(239,68,68,0.1)",padding:"2px 8px",borderRadius:20}}>🔥 FOCUS</span>}
          </div>
        ))}
      </Card>

      {/* EMERGENCY MODE PANEL */}
      {isEmergency&&(
        <Card glow={C.red} style={{background:"rgba(239,68,68,0.08)",border:`2px solid ${C.red}44`}}>
          <div style={{color:C.red,fontWeight:900,fontSize:14,marginBottom:10}}>🚨 LAST 30 DAYS — EMERGENCY PROTOCOL</div>
          {["No new topics — revision + MCQs only","Double MCQ target every day","Mock test every alternate day","Eliminate all entertainment","Sleep at 9:30 PM sharp — non-negotiable","PYQs analysis daily","Mistake notebook review every morning"].map((rule,i)=>(
            <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.red}22`,alignItems:"flex-start"}}>
              <span style={{color:C.red,fontSize:12,flexShrink:0}}>⚡</span>
              <span style={{color:C.text,fontSize:12}}>{rule}</span>
            </div>
          ))}
        </Card>
      )}

      {/* MOTIVATIONAL CONTEXT */}
      {daysLeft!==null&&(
        <Card>
          <div style={{color:C.muted,fontSize:11,fontWeight:700,marginBottom:8}}>📊 TIME REALITY CHECK</div>
          {[
            ["Remaining study sessions (6hr/day)",Math.round(daysLeft*2)+""],
            ["Total MCQs if consistent",((data.dailyMCQTarget||50)*daysLeft).toLocaleString()],
            ["Sundays left",Math.floor(daysLeft/7)+""],
            ["Study hours remaining",((data.dailyStudyHrsTarget||6)*daysLeft)+"h"],
          ].map(([label,val],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.muted,fontSize:12}}>{label}</span>
              <span style={{color:C.gold,fontWeight:800,fontSize:13}}>{val}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── POMODORO ENGINE TAB (v25) ─────────────────────────────────────────────────
function PomodoroTab(){
  const PRESETS=[
    {label:"25/5",work:25,brk:5,color:C.saffron},
    {label:"45/10",work:45,brk:10,color:C.blue},
    {label:"50/10",work:50,brk:10,color:C.purple},
    {label:"Custom",work:null,brk:null,color:C.green},
  ];
  const[preset,setPreset]=useState(0);
  const[customWork,setCustomWork]=useState(30);
  const[customBrk,setCustomBrk]=useState(5);
  const[phase,setPhase]=useState("idle");// idle | work | break
  const[secondsLeft,setSecondsLeft]=useState(0);
  const[sessions,setSessions]=useState(0);
  const[totalFocusSecs,setTotalFocusSecs]=useState(0);
  const[focusStreak,setFocusStreak]=useState(0);
  const[history,setHistory]=useState([]);
  const[sessionLabel,setSessionLabel]=useState("");
  const intervalRef=useRef(null);
  const startFocusSecsRef=useRef(0);

  const loadHistory=async()=>{
    const h=(await stGet("pomodoro-history"))||[];
    setHistory(h);
    const today=todayStr();
    const todaySessions=h.filter(s=>s.date===today);
    setSessions(todaySessions.length);
    const totalSecs=todaySessions.reduce((s,x)=>s+(x.workSecs||0),0);
    setTotalFocusSecs(totalSecs);
    // streak: consecutive days with at least 1 session
    const days=[...new Set(h.map(s=>s.date))].sort().reverse();
    let streak=0;
    const d=new Date();
    for(let i=0;i<60;i++){
      const dk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if(days.includes(dk))streak++;
      else if(i>0)break;
      d.setDate(d.getDate()-1);
    }
    setFocusStreak(streak);
  };
  useEffect(()=>{loadHistory();},[]);

  const workMins=preset===3?customWork:(PRESETS[preset].work);
  const brkMins=preset===3?customBrk:(PRESETS[preset].brk);
  const accentColor=PRESETS[Math.min(preset,3)].color;

  const start=()=>{
    if(phase!=="idle")return;
    setPhase("work");
    const secs=workMins*60;
    setSecondsLeft(secs);
    startFocusSecsRef.current=secs;
    intervalRef.current=setInterval(()=>{
      setSecondsLeft(prev=>{
        if(prev<=1){
          clearInterval(intervalRef.current);
          handleWorkEnd(startFocusSecsRef.current);
          return 0;
        }
        return prev-1;
      });
    },1000);
  };
  const handleWorkEnd=async(workedSecs)=>{
    const entry={date:todayStr(),workSecs:workedSecs,label:sessionLabel||"Focus Session",completedAt:Date.now()};
    const h=(await stGet("pomodoro-history"))||[];
    const updated=[entry,...h].slice(0,200);
    await stSet("pomodoro-history",updated);
    setPhase("break");
    const bSecs=brkMins*60;
    setSecondsLeft(bSecs);
    intervalRef.current=setInterval(()=>{
      setSecondsLeft(prev=>{
        if(prev<=1){clearInterval(intervalRef.current);setPhase("idle");setSecondsLeft(0);return 0;}
        return prev-1;
      });
    },1000);
    loadHistory();
  };
  const pause=()=>{if(intervalRef.current){clearInterval(intervalRef.current);intervalRef.current=null;setPhase(p=>p==="work"?"paused-work":"paused-break");}};
  const resume=()=>{
    const isWork=phase==="paused-work";
    setPhase(isWork?"work":"break");
    intervalRef.current=setInterval(()=>{
      setSecondsLeft(prev=>{
        if(prev<=1){
          clearInterval(intervalRef.current);
          if(isWork)handleWorkEnd(workMins*60);
          else{setPhase("idle");setSecondsLeft(0);}
          return 0;
        }
        return prev-1;
      });
    },1000);
  };
  const stop=()=>{clearInterval(intervalRef.current);intervalRef.current=null;setPhase("idle");setSecondsLeft(0);};
  useEffect(()=>()=>clearInterval(intervalRef.current),[]);

  const isRunning=phase==="work"||phase==="break";
  const isPaused=phase==="paused-work"||phase==="paused-break";
  const mm=String(Math.floor(secondsLeft/60)).padStart(2,"0");
  const ss=String(secondsLeft%60).padStart(2,"0");
  const totalWorkSecs=workMins*60;
  const progress=totalWorkSecs>0&&phase!=="idle"?((totalWorkSecs-secondsLeft)/totalWorkSecs):0;

  const deepWorkHrs=Math.floor(totalFocusSecs/3600);
  const deepWorkMins=Math.floor((totalFocusSecs%3600)/60);

  return(
    <div>
      <SectionTitle icon="🍅" title="Pomodoro Engine" sub="Deep Work. Zero Distraction. Maximum Output."/>

      {/* PRESET SELECTOR */}
      <Card>
        <div style={{color:C.muted,fontWeight:700,fontSize:12,marginBottom:10,letterSpacing:1}}>SELECT MODE</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {PRESETS.map((p,i)=>(
            <button key={i} onClick={()=>{if(phase==="idle"){setPreset(i);setSecondsLeft(0);}}} style={{flex:1,minWidth:70,padding:"10px 8px",borderRadius:10,border:`2px solid ${preset===i?p.color:C.border}`,background:preset===i?p.color+"22":"transparent",color:preset===i?p.color:C.muted,fontWeight:800,cursor:phase==="idle"?"pointer":"not-allowed",fontSize:12,transition:"all 0.2s"}}>
              {p.label}
              {p.work&&<div style={{fontSize:10,opacity:0.7,marginTop:2}}>{p.work}m/{p.brk}m</div>}
            </button>
          ))}
        </div>
        {preset===3&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
            <div>
              <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Work (min)</div>
              <input type="number" min="5" max="120" value={customWork} onChange={e=>setCustomWork(Number(e.target.value))} style={{...IS,textAlign:"center",fontSize:18,fontWeight:800}}/>
            </div>
            <div>
              <div style={{color:C.muted,fontSize:11,marginBottom:4}}>Break (min)</div>
              <input type="number" min="1" max="30" value={customBrk} onChange={e=>setCustomBrk(Number(e.target.value))} style={{...IS,textAlign:"center",fontSize:18,fontWeight:800}}/>
            </div>
          </div>
        )}
      </Card>

      {/* TIMER DISPLAY */}
      <Card glow={accentColor} style={{textAlign:"center",padding:"24px 16px"}}>
        <div style={{position:"relative",width:180,height:180,margin:"0 auto"}}>
          <svg width="180" height="180" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
            <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
            <circle cx="90" cy="90" r="80" fill="none" stroke={phase==="break"?C.green:accentColor} strokeWidth="8" strokeDasharray={2*Math.PI*80} strokeDashoffset={2*Math.PI*80*(1-progress)} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.5s"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{color:accentColor,fontSize:11,fontWeight:800,letterSpacing:2,marginBottom:4}}>
              {phase==="idle"?"READY":phase==="work"||phase==="paused-work"?"FOCUS":phase==="break"||phase==="paused-break"?"BREAK":""}
            </div>
            <div style={{fontSize:42,fontWeight:900,color:C.text,letterSpacing:2}}>{phase==="idle"?`${String(workMins).padStart(2,"0")}:00`:`${mm}:${ss}`}</div>
            {isPaused&&<div style={{color:C.gold,fontSize:11,fontWeight:700,marginTop:4}}>PAUSED</div>}
          </div>
        </div>

        <div style={{marginTop:10,marginBottom:14}}>
          <input value={sessionLabel} onChange={e=>setSessionLabel(e.target.value)} style={{...IS,textAlign:"center",fontSize:12,padding:"6px 12px"}} placeholder="Session label (optional)..."/>
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          {phase==="idle"&&(
            <button onClick={start} style={{background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,color:"#fff",border:"none",borderRadius:14,padding:"14px 36px",fontSize:16,fontWeight:900,cursor:"pointer",boxShadow:`0 4px 20px ${accentColor}40`}}>▶ START</button>
          )}
          {(isRunning||isPaused)&&(
            <>
              {isRunning?<button onClick={pause} style={{background:"rgba(255,255,255,0.08)",color:C.text,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 24px",fontSize:14,fontWeight:800,cursor:"pointer"}}>⏸ Pause</button>:
              <button onClick={resume} style={{background:`${accentColor}22`,color:accentColor,border:`1px solid ${accentColor}`,borderRadius:14,padding:"12px 24px",fontSize:14,fontWeight:800,cursor:"pointer"}}>▶ Resume</button>}
              <button onClick={stop} style={{background:"rgba(239,68,68,0.1)",color:C.red,border:`1px solid ${C.red}44`,borderRadius:14,padding:"12px 24px",fontSize:14,fontWeight:800,cursor:"pointer"}}>⏹ Stop</button>
            </>
          )}
        </div>
      </Card>

      {/* TODAY'S STATS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[
          {icon:"🍅",label:"Sessions Today",value:sessions,color:C.saffron},
          {icon:"⚡",label:"Deep Work",value:`${deepWorkHrs}h${deepWorkMins>0?` ${deepWorkMins}m`:""}`,color:C.blue},
          {icon:"🔥",label:"Focus Streak",value:focusStreak+"d",color:C.green},
        ].map((s,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${s.color}33`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:20}}>{s.icon}</div>
            <div style={{color:s.color,fontWeight:900,fontSize:16,marginTop:4}}>{s.value}</div>
            <div style={{color:C.muted,fontSize:10,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SESSION HISTORY */}
      <Card>
        <div style={{color:C.muted,fontWeight:700,fontSize:12,marginBottom:10,letterSpacing:1}}>📋 SESSION HISTORY (Today)</div>
        {history.filter(h=>h.date===todayStr()).length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No sessions today yet. Start your first Pomodoro! 🍅</div>}
        {history.filter(h=>h.date===todayStr()).map((h,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{color:C.text,fontSize:12}}>{h.label}</span>
            <span style={{color:C.gold,fontSize:12,fontWeight:700}}>{Math.round(h.workSecs/60)}min</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── ONE TASK LOCK TAB (v25) ────────────────────────────────────────────────────
function ONETaskTab(){
  const[today,setToday]=useState({task:"",done:false,savedAt:null});
  const[tomorrow,setTomorrow]=useState("");
  const[history,setHistory]=useState([]);
  const[view,setView]=useState("today");

  const load=async()=>{
    const td=await stGet("onetask:"+todayStr());
    if(td)setToday(td);
    const tm=await stGet("onetask-tomorrow");
    if(tm)setTomorrow(tm.text||"");
    const keys=await stList("onetask:");
    const all=[];
    for(const k of keys){const v=await stGet(k);if(v&&v.task)all.push(v);}
    all.sort((a,b)=>b.savedAt-a.savedAt);
    setHistory(all);
  };
  useEffect(()=>{load();},[]);

  const saveTask=async(updated)=>{
    const n={...today,...updated,savedAt:Date.now()};
    setToday(n);
    await stSet("onetask:"+todayStr(),n);
  };
  const saveTomorrow=async(val)=>{
    setTomorrow(val);
    await stSet("onetask-tomorrow",{text:val,savedAt:Date.now()});
  };

  const isLocked=today.task&&today.task.trim().length>0;

  return(
    <div>
      <SectionTitle icon="🔒" title="ONE Task Lock" sub="Lock today's most important task. No distractions."/>

      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {[["today","🎯 Today"],["tomorrow","🌅 Tomorrow"],["history","📋 History"]].map(([id,lb])=>(
          <button key={id} onClick={()=>setView(id)} style={{flex:1,padding:"9px 6px",borderRadius:10,border:"none",background:view===id?C.saffron:"rgba(255,255,255,0.06)",color:view===id?"#000":C.muted,fontWeight:700,cursor:"pointer",fontSize:11}}>{lb}</button>
        ))}
      </div>

      {view==="today"&&(
        <div>
          {/* LOCK CARD */}
          <Card glow={isLocked?C.saffron:C.border} style={{background:isLocked?`linear-gradient(135deg,rgba(255,107,53,0.12),rgba(244,167,38,0.06))`:"",textAlign:"center",padding:"24px 16px"}}>
            <div style={{fontSize:40,marginBottom:12}}>{isLocked?(today.done?"🏆":"🔒"):"🔓"}</div>
            <div style={{color:isLocked?C.saffron:C.muted,fontWeight:900,fontSize:12,letterSpacing:2,marginBottom:12}}>
              {isLocked?(today.done?"COMPLETED!":"LOCKED IN — DO THIS FIRST"):"UNLOCK YOUR ONE TASK"}
            </div>
            {isLocked?(
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:12,padding:"16px 20px",marginBottom:16}}>
                <div style={{color:C.text,fontSize:18,fontWeight:800,lineHeight:1.4}}>{today.task}</div>
              </div>
            ):(
              <textarea value={today.task} onChange={e=>saveTask({task:e.target.value})} style={{...IS,width:"100%",minHeight:80,fontSize:16,fontWeight:700,textAlign:"center",resize:"none",marginBottom:12}} placeholder="What is the ONE thing you must do today?"/>
            )}
            {isLocked&&(
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>saveTask({done:!today.done})} style={{background:today.done?C.green:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:900,cursor:"pointer",fontSize:14,boxShadow:`0 4px 20px ${today.done?C.green:C.saffron}40`}}>
                  {today.done?"✓ DONE! Tap to undo":"☐ Mark as DONE"}
                </button>
                {!today.done&&<button onClick={()=>saveTask({task:""})} style={{background:"rgba(239,68,68,0.1)",color:C.red,border:`1px solid ${C.red}33`,borderRadius:12,padding:"12px 20px",fontWeight:700,cursor:"pointer",fontSize:13}}>🔓 Unlock</button>}
              </div>
            )}
            {!isLocked&&today.task&&(
              <button onClick={()=>saveTask({task:today.task.trim()})} style={{background:`linear-gradient(135deg,${C.saffron},${C.gold})`,color:"#fff",border:"none",borderRadius:12,padding:"14px 32px",fontWeight:900,cursor:"pointer",fontSize:15,boxShadow:`0 4px 20px ${C.saffron}40`}}>🔒 LOCK IT IN</button>
            )}
          </Card>

          {/* MOTIVATIONAL RULE */}
          <Card style={{background:"rgba(255,107,53,0.06)"}}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:8}}>🧠 THE ONE TASK RULE</div>
            {["This is your most important task today — nothing else matters until this is done.","If you accomplish only this task today, your day is a success.","No phone, no YouTube, no shortcuts. Do this task FIRST after morning ritual.","Write it. Lock it. Destroy it."].map((rule,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"5px 0",color:C.text,fontSize:12,borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.saffron}}>→</span><span>{rule}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {view==="tomorrow"&&(
        <div>
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:14,marginBottom:6}}>🌅 Tomorrow's ONE Task</div>
            <div style={{color:C.muted,fontSize:12,marginBottom:12}}>Plan tonight, execute tomorrow morning with zero friction.</div>
            <textarea value={tomorrow} onChange={e=>saveTomorrow(e.target.value)} style={{...IS,width:"100%",minHeight:80,fontSize:15,fontWeight:700,resize:"none"}} placeholder="What is tomorrow's single most important task?"/>
            <div style={{marginTop:10,color:C.muted,fontSize:11}}>💡 Tip: Set this every night at 9 PM during your planning ritual. Remove all friction for tomorrow morning.</div>
          </Card>
          {tomorrow&&(
            <Card style={{background:"rgba(59,130,246,0.06)",border:`1px solid ${C.blue}33`,textAlign:"center"}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:6}}>TOMORROW YOU WILL:</div>
              <div style={{color:C.text,fontSize:17,fontWeight:800}}>{tomorrow}</div>
            </Card>
          )}
        </div>
      )}

      {view==="history"&&(
        <div>
          <div style={{color:C.muted,fontSize:12,marginBottom:12,textAlign:"center"}}>Your ONE Task track record — {history.filter(h=>h.done).length}/{history.length} completed</div>
          {history.length===0&&<Card><div style={{color:C.muted,textAlign:"center",padding:"20px 0"}}>No tasks locked yet. Start today! 🔒</div></Card>}
          {history.map((h,i)=>{
            const d=new Date(h.savedAt);
            const dateStr=`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            return(
              <Card key={i} style={{borderLeft:`3px solid ${h.done?C.green:C.red}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{color:C.muted,fontSize:10,marginBottom:4}}>{dateStr}</div>
                    <div style={{color:C.text,fontSize:13,fontWeight:700,textDecoration:h.done?"line-through":"none",opacity:h.done?0.6:1}}>{h.task}</div>
                  </div>
                  <span style={{color:h.done?C.green:C.red,fontSize:18,flexShrink:0,marginLeft:10}}>{h.done?"✓":"✕"}</span>
                </div>
              </Card>
            );
          })}
          {history.length>0&&(
            <Card glow={C.green} style={{textAlign:"center"}}>
              <div style={{color:C.muted,fontSize:11}}>Completion Rate</div>
              <div style={{color:C.green,fontSize:32,fontWeight:900,marginTop:4}}>{Math.round(history.filter(h=>h.done).length/history.length*100)}%</div>
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,marginTop:10,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.round(history.filter(h=>h.done).length/history.length*100)+"%",background:`linear-gradient(90deg,${C.green},${C.teal})`,borderRadius:3}}/>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// V36 PREMIUM SHELL SYSTEM
// NEW: Global Search · Command Palette · Workspace Dashboards · Today Mode
//      Progressive Disclosure · Smart Context · Persistent Nav · Micro-Interactions
// ALL ORIGINAL TABS & DATA 100% INTACT — only shell layer redesigned
// ══════════════════════════════════════════════════════════════════════════════

// ─── WORKSPACE DASHBOARD SYSTEM ───────────────────────────────────────────────
// Each group gets a beautiful dashboard before opening individual modules.

function WorkspaceDashboard({group,onNavigate}){
  const{data}=useEC();
  const g=TAB_GROUPS.find(x=>x.id===group);
  if(!g)return null;

  const[liveData,setLiveData]=useState({});
  useEffect(()=>{
    (async()=>{
      const ht=await stGet("health-daily:"+todayStr());
      const sl=await stGet("study-log:"+todayStr());
      const ot=await stGet("onetask:"+todayStr());
      let sess=0,wk=0;
      const pk=await stList("pom-history:");
      for(const k of pk){const v=await stGet(k);if(v&&v.date===todayStr()){sess++;wk+=v.workSecs||0;}}
      setLiveData({health:ht?.data||{},study:sl?.data||{},oneTask:ot||{},pomSessions:sess,pomMins:Math.round(wk/60)});
    })();
  },[]);

  const subProg=data.subjectProgress||[];
  const avgProg=subProg.length?Math.round(subProg.reduce((s,x)=>s+Number(x.pct||0),0)/subProg.length):0;

  // Per-group dashboard config
  const configs={
    today:{
      hero:{title:"Today's Command",sub:"Focus · Execute · Win",metric:liveData.oneTask?.task?liveData.oneTask.task.slice(0,40)+"…":"No task locked yet",metricLabel:"ONE Task"},
      stats:[
        {icon:"🍅",label:"Pomodoros",value:liveData.pomSessions||"0",color:C.red},
        {icon:"⏱️",label:"Focus Time",value:`${liveData.pomMins||0}m`,color:C.blue},
        {icon:"✅",label:"ONE Task",value:liveData.oneTask?.done?"Done ✓":"Pending",color:liveData.oneTask?.done?C.green:C.gold},
      ],
      shortcuts:g.tabs,
    },
    study:{
      hero:{title:"Study Hub",sub:"Learn · Practice · Master",metric:liveData.study?.studyHrs?`${liveData.study.studyHrs}h studied today`:"Log today's study →",metricLabel:"Today"},
      stats:[
        {icon:"📚",label:"Avg Progress",value:avgProg+"%",color:C.green},
        {icon:"✅",label:"MCQs Today",value:liveData.study?.mcqs||"—",color:C.blue},
        {icon:"🃏",label:"Anki Cards",value:liveData.study?.anki||"—",color:C.gold},
      ],
      shortcuts:g.tabs,
    },
    track:{
      hero:{title:"Performance HQ",sub:"Measure · Analyze · Improve",metric:avgProg+"%",metricLabel:"Overall Progress"},
      stats:[
        {icon:"📈",label:"Study Avg",value:avgProg+"%",color:C.green},
        {icon:"🏆",label:"Milestones",value:(data.milestones||[]).filter(m=>m.done).length+"/"+(data.milestones||[]).length,color:C.gold},
        {icon:"🔥",label:"Subjects",value:subProg.filter(s=>Number(s.pct)>=80).length+" strong",color:C.saffron},
      ],
      shortcuts:g.tabs,
    },
    mind:{
      hero:{title:"Mind & Mastery",sub:"Reflect · Lead · Grow",metric:"\""+((data.philosophyCodes||[])[0]||"All Is Well")+"\"",metricLabel:"Philosophy"},
      stats:[
        {icon:"👑",label:"Identity",value:"Active",color:C.gold},
        {icon:"🧘",label:"Flow State",value:"Practice",color:C.purple},
        {icon:"🕉️",label:"Spiritual",value:"Daily",color:C.teal},
      ],
      shortcuts:g.tabs,
    },
    life:{
      hero:{title:"Life & Health",sub:"Vitality · Balance · Joy",metric:liveData.health?.water?`${liveData.health.water} glasses today`:"Log today →",metricLabel:"Hydration"},
      stats:[
        {icon:"💧",label:"Water",value:liveData.health?.water||"—",color:C.blue},
        {icon:"😊",label:"Mood",value:liveData.health?.mood?`${liveData.health.mood}/10`:"—",color:C.purple},
        {icon:"😴",label:"Sleep",value:liveData.health?.sleep?`${liveData.health.sleep}h`:"—",color:C.teal},
      ],
      shortcuts:g.tabs,
    },
    build:{
      hero:{title:"Build & Create",sub:"Ideas · Knowledge · Content",metric:(data.ideas||[]).length+" ideas",metricLabel:"Captured"},
      stats:[
        {icon:"💡",label:"Ideas",value:(data.ideas||[]).length,color:C.gold},
        {icon:"🗂️",label:"Notes",value:"Active",color:C.blue},
        {icon:"📆",label:"Content",value:"In Progress",color:C.purple},
      ],
      shortcuts:g.tabs,
    },
  };

  const cfg=configs[group]||configs.today;

  return(
    <div>
      {/* HERO CARD */}
      <div style={{background:`linear-gradient(135deg,${g.color}18,${g.color}08)`,border:`1px solid ${g.color}30`,borderRadius:20,padding:"20px 18px",marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,background:`radial-gradient(circle,${g.color}12,transparent)`,borderRadius:"50%"}}/>
        <div style={{fontSize:10,color:`${g.color}aa`,letterSpacing:2,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{g.icon} {g.label} WORKSPACE</div>
        <div style={{fontSize:20,fontWeight:900,color:C.text,marginBottom:3}}>{cfg.hero.title}</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{cfg.hero.sub}</div>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:12,padding:"10px 14px",display:"inline-block"}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{cfg.hero.metricLabel}</div>
          <div style={{fontSize:14,fontWeight:800,color:g.color,lineHeight:1.3,maxWidth:240}}>{cfg.hero.metric}</div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {cfg.stats.map((s,i)=>(
          <div key={i} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${s.color}20`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{color:s.color,fontWeight:900,fontSize:15}}>{s.value}</div>
            <div style={{color:C.muted,fontSize:10,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* QUICK SHORTCUTS */}
      <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.06)`,borderRadius:16,padding:"14px 14px",marginBottom:14}}>
        <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>OPEN MODULE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {cfg.shortcuts.map(t=>(
            <button key={t.id} onClick={()=>onNavigate(t.id,group)} style={{
              display:"flex",alignItems:"center",gap:8,
              background:`${g.color}0a`,border:`1px solid ${g.color}20`,
              borderRadius:12,padding:"11px 12px",cursor:"pointer",textAlign:"left",
              WebkitTapHighlightColor:"transparent",transition:"all 0.15s",
            }}>
              <span style={{fontSize:16,flexShrink:0}}>{t.icon}</span>
              <span style={{color:C.text,fontSize:12,fontWeight:600,lineHeight:1.3}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
function GlobalSearch({onNavigate,onClose}){
  const{data}=useEC();
  const[q,setQ]=useState("");
  const[results,setResults]=useState([]);
  const inputRef=useRef(null);

  useEffect(()=>{
    setTimeout(()=>inputRef.current?.focus(),100);
  },[]);

  useEffect(()=>{
    if(!q.trim()){setResults([]);return;}
    const lq=q.toLowerCase();
    const hits=[];

    // Search across tabs by label
    TABS.forEach(t=>{
      if(t.label.toLowerCase().includes(lq)||t.id.toLowerCase().includes(lq)){
        const grp=TAB_GROUPS.find(g=>g.tabs.some(x=>x.id===t.id));
        hits.push({type:"tab",icon:t.icon,label:t.label,sub:grp?.label||"",tab:t.id,group:grp?.id||"today",color:grp?.color||C.muted});
      }
    });

    // Search ideas
    (data.ideas||[]).forEach((idea,i)=>{
      const txt=(typeof idea==="string"?idea:idea.text||idea.title||"").toLowerCase();
      if(txt.includes(lq))hits.push({type:"idea",icon:"💡",label:typeof idea==="string"?idea:(idea.text||idea.title||"Idea"),sub:"Ideas",tab:"ideas",group:"build",color:C.gold});
    });

    // Search philosophy codes
    (data.philosophyCodes||[]).forEach(p=>{
      if(p.toLowerCase().includes(lq))hits.push({type:"wisdom",icon:"🧠",label:p.slice(0,60)+(p.length>60?"…":""),sub:"Philosophy",tab:"identity",group:"mind",color:C.purple});
    });

    // Search identity priorities
    (data.priorities||[]).forEach(p=>{
      if(p.toLowerCase().includes(lq))hits.push({type:"priority",icon:"🎯",label:p,sub:"Priorities",tab:"identity",group:"mind",color:C.saffron});
    });

    // Search schedule items
    (data.schedule||[]).forEach(s=>{
      const txt=((s.activity||"")+(s.detail||"")).toLowerCase();
      if(txt.includes(lq))hits.push({type:"schedule",icon:"⏰",label:s.activity,sub:`Schedule · ${s.time}`,tab:"schedule",group:"study",color:C.purple});
    });

    // Search milestones
    (data.milestones||[]).forEach(m=>{
      if((m.label||"").toLowerCase().includes(lq))hits.push({type:"milestone",icon:m.done?"✅":"🏆",label:m.label,sub:"Milestones",tab:"progress",group:"track",color:C.gold});
    });

    setResults(hits.slice(0,12));
  },[q,data]);

  const recentSearches=["study","pomodoro","water","mcq","mood"];

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",flexDirection:"column",padding:"60px 16px 16px"}}>
      {/* Search input */}
      <div style={{background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.15)`,borderRadius:16,display:"flex",alignItems:"center",gap:10,padding:"12px 16px",marginBottom:16}}>
        <span style={{fontSize:18,opacity:0.6}}>🔍</span>
        <input
          ref={inputRef}
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Search tabs, ideas, tasks, schedule…"
          style={{flex:1,background:"transparent",border:"none",color:C.text,fontSize:16,fontWeight:500,outline:"none"}}
        />
        {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",padding:0}}>✕</button>}
      </div>

      {/* Results */}
      <div style={{flex:1,overflowY:"auto"}}>
        {!q&&(
          <div>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>QUICK NAVIGATE</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              {recentSearches.map(s=>(
                <button key={s} onClick={()=>setQ(s)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"6px 14px",color:C.muted,fontSize:12,cursor:"pointer"}}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>ALL MODULES</div>
            {TAB_GROUPS.map(g=>(
              <div key={g.id} style={{marginBottom:16}}>
                <div style={{fontSize:11,color:g.color,fontWeight:700,letterSpacing:1,marginBottom:6}}>{g.icon} {g.label}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {g.tabs.map(t=>(
                    <button key={t.id} onClick={()=>{onNavigate(t.id,g.id);onClose();}} style={{background:`${g.color}10`,border:`1px solid ${g.color}25`,borderRadius:10,padding:"6px 12px",color:C.text,fontSize:12,cursor:"pointer"}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {q&&results.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"40px 0",fontSize:14}}>No results for "{q}"</div>}
        {q&&results.map((r,i)=>(
          <button key={i} onClick={()=>{onNavigate(r.tab,r.group);onClose();}} style={{
            width:"100%",display:"flex",alignItems:"center",gap:12,
            background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.07)`,
            borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer",textAlign:"left",
            WebkitTapHighlightColor:"transparent",
          }}>
            <div style={{width:36,height:36,background:`${r.color}15`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:C.text,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
              <div style={{color:r.color,fontSize:10,fontWeight:700,letterSpacing:0.5,marginTop:1}}>{r.sub}</div>
            </div>
            <span style={{color:C.muted,fontSize:14,flexShrink:0}}>→</span>
          </button>
        ))}
      </div>

      <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px",color:C.muted,fontSize:14,cursor:"pointer",marginTop:12}}>
        Cancel
      </button>
    </div>
  );
}

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
function CommandPalette({onNavigate,onClose}){
  const ACTIONS=[
    {icon:"🍅",label:"Start Pomodoro",tab:"pomodoro",group:"today",color:C.red},
    {icon:"🔒",label:"Lock ONE Task",tab:"onetask",group:"today",color:C.saffron},
    {icon:"✅",label:"Open Checklist",tab:"checklist",group:"today",color:C.green},
    {icon:"💧",label:"Log Water",tab:"health",group:"life",color:C.blue},
    {icon:"😊",label:"Log Mood",tab:"health",group:"life",color:C.purple},
    {icon:"😴",label:"Log Sleep",tab:"health",group:"life",color:C.teal},
    {icon:"💰",label:"Log Expense",tab:"money",group:"life",color:C.gold},
    {icon:"💡",label:"Add Idea",tab:"ideas",group:"build",color:C.gold},
    {icon:"🎙️",label:"Voice Note",tab:"voicenotes",group:"build",color:C.pink},
    {icon:"🎯",label:"Add MCQ",tab:"mcqtracker",group:"study",color:C.green},
    {icon:"📖",label:"Mistake Book",tab:"mistakebook",group:"study",color:C.red},
    {icon:"🪞",label:"Daily Reflection",tab:"reflection",group:"mind",color:C.purple},
    {icon:"📊",label:"View Analytics",tab:"analytics",group:"track",color:C.blue},
    {icon:"🔥",label:"Habit Heatmap",tab:"habitheatmap",group:"track",color:C.saffron},
    {icon:"📅",label:"My Schedule",tab:"schedule",group:"study",color:C.purple},
    {icon:"👔",label:"CEO Review",tab:"ceoreview",group:"mind",color:C.gold},
    {icon:"🗂️",label:"Knowledge Base",tab:"knowledge",group:"build",color:C.blue},
    {icon:"📋",label:"Quick Reference",tab:"quickref",group:"build",color:C.teal},
  ];

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",display:"flex",flexDirection:"column",padding:"40px 16px 16px"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:12,color:C.muted,letterSpacing:2,fontWeight:700,textTransform:"uppercase"}}>⚡ COMMAND PALETTE</div>
        <div style={{fontSize:11,color:`${C.muted}80`,marginTop:4}}>Tap any action to execute instantly</div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {ACTIONS.map((a,i)=>(
            <button key={i} onClick={()=>{onNavigate(a.tab,a.group);onClose();}} style={{
              display:"flex",alignItems:"center",gap:10,
              background:`${a.color}0c`,border:`1px solid ${a.color}25`,
              borderRadius:14,padding:"13px 12px",cursor:"pointer",textAlign:"left",
              WebkitTapHighlightColor:"transparent",transition:"all 0.15s",
            }}>
              <span style={{fontSize:20,flexShrink:0}}>{a.icon}</span>
              <span style={{color:C.text,fontSize:12,fontWeight:600,lineHeight:1.3}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px",color:C.muted,fontSize:14,cursor:"pointer",marginTop:14}}>
        Cancel
      </button>
    </div>
  );
}

// ─── TODAY MODE ───────────────────────────────────────────────────────────────
function TodayMode({onNavigate,onExit}){
  const{data}=useEC();
  const[time,setTime]=useState(new Date());
  const[liveData,setLiveData]=useState({health:{},study:{},oneTask:{},pomSessions:0,pomMins:0});
  const[quote,setQuote]=useState("");

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date()),10000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const quotes=data.philosophyCodes||[];
    if(quotes.length)setQuote(quotes[Math.floor(Date.now()/1000/3600)%quotes.length]);
    (async()=>{
      const ht=await stGet("health-daily:"+todayStr());
      const sl=await stGet("study-log:"+todayStr());
      const ot=await stGet("onetask:"+todayStr());
      let sess=0,wk=0;
      const pk=await stList("pom-history:");
      for(const k of pk){const v=await stGet(k);if(v&&v.date===todayStr()){sess++;wk+=v.workSecs||0;}}
      setLiveData({health:ht?.data||{},study:sl?.data||{},oneTask:ot||{},pomSessions:sess,pomMins:Math.round(wk/60)});
    })();
  },[]);

  const hr=time.getHours();
  const min=time.getMinutes();
  const timeStr=`${String(hr).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
  const subProg=data.subjectProgress||[];
  const avgProg=subProg.length?Math.round(subProg.reduce((s,x)=>s+Number(x.pct||0),0)/subProg.length):0;
  const countdowns=data.examCountdowns||[];
  const daysLeft=countdowns[0]?.date?Math.max(0,Math.ceil((new Date(countdowns[0].date)-new Date())/(1000*60*60*24))):null;

  const big3=[
    liveData.oneTask?.task||"No task locked",
    data.priorities?.[0]||"ADO + Patwari Selection",
    "Stay disciplined today",
  ];

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"linear-gradient(180deg,#060610 0%,#0a0a18 100%)",overflowY:"auto",padding:"0 0 40px"}}>
      {/* EXIT */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px"}}>
        <div style={{fontSize:11,color:C.muted,letterSpacing:2,fontWeight:700}}>TODAY MODE</div>
        <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"7px 14px",color:C.muted,fontSize:12,cursor:"pointer"}}>Exit</button>
      </div>

      {/* CLOCK */}
      <div style={{textAlign:"center",padding:"20px 20px 10px"}}>
        <div style={{fontSize:56,fontWeight:900,letterSpacing:2,background:`linear-gradient(90deg,${C.saffron},${C.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>{timeStr}</div>
        <div style={{color:C.muted,fontSize:12,marginTop:6}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
      </div>

      {/* TODAY'S BIG 3 */}
      <div style={{margin:"20px 16px 12px",background:`linear-gradient(135deg,${C.saffron}12,${C.gold}08)`,border:`1px solid ${C.saffron}25`,borderRadius:18,padding:"16px"}}>
        <div style={{fontSize:10,color:C.saffron,fontWeight:800,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>🎯 Today's Big 3</div>
        {big3.map((t,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:i<2?`1px solid rgba(255,255,255,0.05)`:"none"}}>
            <div style={{width:22,height:22,borderRadius:8,background:`${C.saffron}20`,border:`1px solid ${C.saffron}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:C.saffron,flexShrink:0}}>{i+1}</div>
            <div style={{color:C.text,fontSize:13,fontWeight:600,lineHeight:1.4,paddingTop:2}}>{t}</div>
          </div>
        ))}
      </div>

      {/* STATUS GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"0 16px 12px"}}>
        {[
          {icon:"📚",label:"Study",value:liveData.study?.studyHrs?`${liveData.study.studyHrs}h`:"—",color:C.green,tap:()=>onNavigate("study","study")},
          {icon:"💧",label:"Water",value:liveData.health?.water?`${liveData.health.water}gl`:"—",color:C.blue,tap:()=>onNavigate("health","life")},
          {icon:"😊",label:"Mood",value:liveData.health?.mood?`${liveData.health.mood}/10`:"—",color:C.purple,tap:()=>onNavigate("health","life")},
          {icon:"😴",label:"Sleep",value:liveData.health?.sleep?`${liveData.health.sleep}h`:"—",color:C.teal,tap:()=>onNavigate("health","life")},
          {icon:"🍅",label:"Focus",value:`${liveData.pomSessions}x`,color:C.red,tap:()=>onNavigate("pomodoro","today")},
          {icon:"📊",label:"Progress",value:`${avgProg}%`,color:C.gold,tap:()=>onNavigate("progress","track")},
        ].map((s,i)=>(
          <button key={i} onClick={s.tap} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${s.color}20`,borderRadius:14,padding:"12px 8px",textAlign:"center",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
            <div style={{fontSize:20}}>{s.icon}</div>
            <div style={{color:s.color,fontWeight:900,fontSize:15,marginTop:4}}>{s.value}</div>
            <div style={{color:C.muted,fontSize:10,marginTop:2}}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* EXAM COUNTDOWN */}
      {daysLeft!==null&&(
        <div style={{margin:"0 16px 12px",background:"rgba(255,107,53,0.08)",border:`1px solid ${C.saffron}30`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1}}>COUNTDOWN</div>
            <div style={{fontSize:14,fontWeight:800,color:C.text,marginTop:2}}>{countdowns[0]?.label||"Exam"}</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:36,fontWeight:900,color:C.saffron,lineHeight:1}}>{daysLeft}</div>
            <div style={{fontSize:10,color:C.muted}}>days</div>
          </div>
        </div>
      )}

      {/* QUOTE */}
      <div style={{margin:"0 16px",background:"rgba(139,92,246,0.06)",border:`1px solid ${C.purple}20`,borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:C.purple,fontWeight:700,marginBottom:6}}>💜 Today's Wisdom</div>
        <div style={{fontSize:13,color:C.muted,lineHeight:1.6,fontStyle:"italic"}}>"{quote}"</div>
      </div>
    </div>
  );
}

// ─── LOADING SCREEN ────────────────────────────────────────────────────────────
function LoadingScreen(){
  const[dots,setDots]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setDots(d=>(d+1)%4),400);return()=>clearInterval(t);},[]);
  return(
    <div style={{minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#0a0a0f 0%,#111122 100%)"}}>
      <div style={{width:72,height:72,background:`linear-gradient(135deg,${C.saffron},${C.gold})`,borderRadius:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:24,boxShadow:`0 8px 40px ${C.saffron}40`}}>🎯</div>
      <div style={{fontSize:20,fontWeight:900,background:`linear-gradient(90deg,${C.saffron},${C.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:8,letterSpacing:0.5}}>LIFE OS</div>
      <div style={{color:C.muted,fontSize:13}}>Loading{".".repeat(dots+1)}</div>
    </div>
  );
}

// ─── BOTTOM NAVIGATION ────────────────────────────────────────────────────────
function BottomNav({activeGroup,onGroupChange,currentTab,onTabChange,onSearchOpen,onCommandOpen,onTodayMode}){
  const group=TAB_GROUPS.find(g=>g.id===activeGroup);
  const grpColor=group?.color||C.saffron;

  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100}}>
      {/* Sub-tabs — shown when group is active (not home) */}
      {activeGroup!=="home"&&(
        <div style={{background:"rgba(8,8,16,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid rgba(255,255,255,0.05)`,padding:"8px 10px 2px",display:"flex",gap:4,overflowX:"auto"}}>
          {group?.tabs.map(t=>{
            const isA=currentTab===t.id;
            return(
              <button key={t.id} onClick={()=>onTabChange(t.id)} style={{
                background:isA?`${grpColor}15`:"transparent",
                color:isA?grpColor:"rgba(255,255,255,0.3)",
                border:`1px solid ${isA?grpColor+"40":"transparent"}`,
                borderRadius:12,padding:"6px 11px",fontSize:11,fontWeight:isA?700:400,
                cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s",
              }}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main nav row */}
      <div style={{background:"rgba(8,8,16,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid rgba(255,255,255,0.07)`,display:"flex",padding:"5px 0 max(env(safe-area-inset-bottom,0px),8px)"}}>
        {[
          {id:"home",icon:"⊞",label:"Home",color:C.text},
          ...TAB_GROUPS,
          {id:"__search",icon:"🔍",label:"Search",color:C.blue},
        ].map(g=>{
          const isA=activeGroup===g.id;
          const col=g.color||C.text;
          const isSpecial=g.id==="__search";
          return(
            <button key={g.id} onClick={()=>isSpecial?onSearchOpen():onGroupChange(g.id)} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              background:"transparent",border:"none",cursor:"pointer",padding:"4px 2px",
              WebkitTapHighlightColor:"transparent",
            }}>
              <div style={{
                width:isA?34:26,height:isA?34:26,borderRadius:isA?11:9,
                background:isA?col:`${col}00`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:isA?16:13,transition:"all 0.2s",
                boxShadow:isA?`0 2px 12px ${col}44`:"none",
              }}>
                {g.id==="home"?"⊞":g.icon}
              </div>
              <div style={{fontSize:8,color:isA?col:"rgba(255,255,255,0.28)",fontWeight:isA?700:400,letterSpacing:0.2,transition:"all 0.15s"}}>
                {g.id==="home"?"HOME":g.id==="__search"?"SEARCH":g.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── FLOATING ACTION BUTTON ────────────────────────────────────────────────────
function FloatingActionButton({tab,group,onNavigate,onCommand}){
  const[open,setOpen]=useState(false);
  const actions={
    home:[{icon:"⚡",label:"Command Palette",cmd:true},{icon:"🍅",label:"Start Pomodoro",tab:"pomodoro",group:"today"},{icon:"🔒",label:"Lock ONE Task",tab:"onetask",group:"today"}],
    today:[{icon:"🔒",label:"ONE Task",tab:"onetask",group:"today"},{icon:"🍅",label:"Pomodoro",tab:"pomodoro",group:"today"},{icon:"✅",label:"Checklist",tab:"checklist",group:"today"},{icon:"⏳",label:"Countdown",tab:"countdown",group:"today"}],
    study:[{icon:"🎯",label:"Add MCQ",tab:"mcqtracker",group:"study"},{icon:"📖",label:"Mistake Book",tab:"mistakebook",group:"study"},{icon:"📜",label:"PYQ Tracker",tab:"pyqtracker",group:"study"},{icon:"📚",label:"Study Log",tab:"study",group:"study"}],
    track:[{icon:"📈",label:"Analytics",tab:"analytics",group:"track"},{icon:"🔥",label:"Habit Heatmap",tab:"habitheatmap",group:"track"},{icon:"📊",label:"Progress",tab:"progress",group:"track"}],
    mind:[{icon:"🪞",label:"Reflect",tab:"reflection",group:"mind"},{icon:"👔",label:"CEO Review",tab:"ceoreview",group:"mind"},{icon:"🧘",label:"Flow State",tab:"flow",group:"mind"}],
    life:[{icon:"💧",label:"Log Health",tab:"health",group:"life"},{icon:"💰",label:"Log Money",tab:"money",group:"life"},{icon:"😊",label:"Happiness",tab:"happiness",group:"life"}],
    build:[{icon:"💡",label:"Add Idea",tab:"ideas",group:"build"},{icon:"🎙️",label:"Voice Note",tab:"voicenotes",group:"build"},{icon:"🗂️",label:"Knowledge",tab:"knowledge",group:"build"}],
  };
  const items=actions[group]||actions.home;

  return(
    <div style={{position:"fixed",right:14,zIndex:200,display:"flex",flexDirection:"column-reverse",alignItems:"flex-end",gap:8,
      bottom:activeGroup==="home"?76:118,
    }}>
      {open&&items.map((a,i)=>(
        <button key={i} onClick={()=>{if(a.cmd){onCommand();setOpen(false);}else{onNavigate(a.tab,a.group);setOpen(false);}}} style={{
          display:"flex",alignItems:"center",gap:8,
          background:"rgba(14,14,24,0.98)",backdropFilter:"blur(16px)",
          border:`1px solid rgba(255,255,255,0.12)`,
          borderRadius:24,padding:"10px 16px",cursor:"pointer",whiteSpace:"nowrap",
          boxShadow:"0 4px 24px rgba(0,0,0,0.6)",fontSize:13,color:C.text,fontWeight:600,
          transform:"translateY(0)",transition:`opacity 0.2s ${i*0.04}s, transform 0.2s ${i*0.04}s`,
          opacity:open?1:0,WebkitTapHighlightColor:"transparent",
        }}>
          <span style={{fontSize:16}}>{a.icon}</span>{a.label}
        </button>
      ))}
      <button onClick={()=>setOpen(!open)} style={{
        width:50,height:50,borderRadius:25,
        background:open?"rgba(239,68,68,0.9)":`linear-gradient(135deg,${C.saffron},${C.gold})`,
        border:"none",cursor:"pointer",fontSize:open?16:22,
        boxShadow:`0 4px 20px ${open?"rgba(239,68,68,0.5)":C.saffron+"55"}`,
        transition:"all 0.25s",transform:open?"rotate(45deg)":"rotate(0deg)",
        display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",
        WebkitTapHighlightColor:"transparent",
      }}>
        {open?"✕":"＋"}
      </button>
    </div>
  );
}

// ─── V37 DIGITAL BRAIN SYSTEMS ────────────────────────────────────────────────

// ── Version History Engine ───────────────────────────────────────────────────
// Every call to vhRecord(key, oldVal, newVal, action) appends a version entry.
// Stored under "vh-<key>" as an array (capped at 200 per key).
const VH_CAP=200;
async function vhRecord(key,oldVal,newVal,action="edit"){
  try{
    const stored=await stGet("vh-"+key);
    const arr=Array.isArray(stored)?stored:[];
    arr.unshift({vid:Date.now()+"_"+Math.random().toString(36).slice(2),
      key,action,ts:Date.now(),date:todayStr(),
      old:oldVal,new:newVal});
    if(arr.length>VH_CAP)arr.length=VH_CAP;
    await stSet("vh-"+key,arr);
  }catch(e){console.error("vhRecord",e);}
}

// ── Snapshot Save System v2 ────────────────────────────────────────────────────
async function snapshotToday(data){
  try{
    const d=todayStr();
    const existing=await stGet("snap-auto-"+d);
    const entry={snapId:"auto-"+d,title:"Auto Snapshot",date:d,ts:Date.now(),type:"auto",data};
    if(!existing)await stSet("snap-auto-"+d,entry);
    else await stSet("snap-auto-"+d,{...existing,lastUpdated:Date.now(),data});
  }catch(e){console.error("snapshotToday",e);}
}

function getWeekNum(d){
  const s=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=s.getUTCDay()||7;
  s.setUTCDate(s.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(s.getUTCFullYear(),0,1));
  return Math.ceil((((s-yearStart)/86400000)+1)/7);
}

async function saveSnapshot(data,opts){
  if(!opts)opts={};
  try{
    const now=new Date();
    const d=todayStr();
    const wk=weekKey();
    const mo=monthKey();
    const yr=now.getFullYear();
    const q=Math.ceil((now.getMonth()+1)/3);
    const wnum=getWeekNum(now);
    const uid="snap-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
    let autoTitle="Custom Snapshot";
    if(opts.title)autoTitle=opts.title;
    else if(opts.type==="weekly")autoTitle="Week "+wnum+" / "+wk;
    else if(opts.type==="monthly")autoTitle=now.toLocaleString("default",{month:"long"})+" "+yr;
    else if(opts.type==="quarterly")autoTitle="Q"+q+" "+yr;
    else if(opts.type==="yearly")autoTitle="Year "+yr;
    else if(opts.type==="daily")autoTitle="Day "+d;
    const entry={
      snapId:uid,title:autoTitle,date:d,week:wk,month:mo,
      quarter:"Q"+q,year:yr,weekNum:wnum,ts:Date.now(),
      type:opts.type||"custom",module:opts.module||"full",
      tags:opts.tags||[],notes:opts.notes||"",version:"v39",data
    };
    await stSet(uid,entry);
    const master=(await stGet("snap-master-index"))||[];
    master.unshift({uid,title:autoTitle,date:d,type:entry.type,ts:entry.ts,module:entry.module,week:wk,month:mo,year:yr,quarter:"Q"+q,weekNum:wnum});
    await stSet("snap-master-index",master);
    await timelineAdd({cat:"snapshot",icon:"📸",label:"Snapshot saved: "+autoTitle,detail:entry.type+" \u00b7 "+d});
    return uid;
  }catch(e){console.error("saveSnapshot",e);return null;}
}

async function loadAllSnapshots(){
  try{return(await stGet("snap-master-index"))||[];}catch(e){return[];}
}
async function loadSnapshotFull(uid){
  try{return await stGet(uid);}catch(e){return null;}
}
async function deleteSnapshot(uid){
  try{
    await stDel(uid);
    const master=(await stGet("snap-master-index"))||[];
    await stSet("snap-master-index",master.filter(m=>m.uid!==uid));
  }catch(e){console.error("deleteSnapshot",e);}
}

function SaveSnapshotButton({type,module,label,data,color,onSaved}){
  const[saving,setSaving]=React.useState(false);
  const[msg,setMsg]=React.useState("");
  const c=color||C.blue;
  const doSave=async()=>{
    setSaving(true);setMsg("");
    const uid=await saveSnapshot(data,{type,module,title:label});
    setSaving(false);
    if(uid){setMsg("\u2705 Saved!");if(onSaved)onSaved(uid);}
    else setMsg("\u274c Failed");
    setTimeout(()=>setMsg(""),3000);
  };
  return(
    <button onClick={doSave} style={{background:c+"18",border:"1px solid "+c+"35",borderRadius:9,padding:"7px 13px",color:c,fontWeight:800,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
      {saving?"Saving...":msg||"\ud83d\udcf8 Save "+(label||"Snapshot")}
    </button>
  );
}

// ── Timeline Event Recorder ───────────────────────────────────────────────────
// Call timelineAdd(event) from anywhere to log a timestamped event.
// Key: "tl-<date>" — array of events per day.
async function timelineAdd(event){
  try{
    const d=todayStr();
    const existing=await stGet("tl-"+d)||[];
    existing.unshift({...event,ts:Date.now(),id:Date.now()+"_"+Math.random().toString(36).slice(2)});
    if(existing.length>500)existing.length=500;
    await stSet("tl-"+d,existing);
  }catch(e){console.error("timelineAdd",e);}
}

// ── Lifetime Timeline Tab ─────────────────────────────────────────────────────
function LifetimeTimelineTab(){
  const[events,setEvents]=useState([]);
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");
  const[dateRange,setDateRange]=useState(7);
  const[loading,setLoading]=useState(true);
  const[addNote,setAddNote]=useState("");
  const[adding,setAdding]=useState(false);

  const CATS=[
    {id:"all",label:"All",icon:"🌐"},
    {id:"study",label:"Study",icon:"📚"},
    {id:"health",label:"Health",icon:"💪"},
    {id:"idea",label:"Ideas",icon:"💡"},
    {id:"task",label:"Tasks",icon:"✅"},
    {id:"note",label:"Notes",icon:"📝"},
    {id:"snapshot",label:"Snapshots",icon:"📸"},
  ];

  const load=async()=>{
    setLoading(true);
    const days=[];
    for(let i=0;i<dateRange;i++){
      const d=new Date();d.setDate(d.getDate()-i);
      const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push(ds);
    }
    const all=[];
    for(const d of days){
      const evs=await stGet("tl-"+d)||[];
      if(Array.isArray(evs))all.push(...evs.map(e=>({...e,date:d})));
      // Also check if snapshot exists for this day
      const snap=await stGet("snap-"+d);
      if(snap)all.push({id:"snap-"+d,ts:snap.ts,date:d,cat:"snapshot",icon:"📸",label:"Daily Snapshot saved",detail:`Full OS snapshot at ${new Date(snap.ts).toLocaleTimeString()}`});
    }
    all.sort((a,b)=>b.ts-a.ts);
    setEvents(all);
    setLoading(false);
  };

  useEffect(()=>{load();},[dateRange]);

  const addManualNote=async()=>{
    if(!addNote.trim())return;
    setAdding(true);
    await timelineAdd({cat:"note",icon:"📝",label:addNote.trim(),detail:"Manual note"});
    setAddNote("");
    await load();
    setAdding(false);
  };

  const filtered=events.filter(e=>{
    if(filter!=="all"&&e.cat!==filter)return false;
    if(search&&!JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const grouped={};
  filtered.forEach(e=>{
    if(!grouped[e.date])grouped[e.date]=[];
    grouped[e.date].push(e);
  });

  const catColors={study:C.green,health:C.teal,idea:C.gold,task:C.saffron,note:C.purple,snapshot:C.blue,default:C.muted};
  const cc=cat=>catColors[cat]||catColors.default;

  return(
    <div>
      <SectionTitle icon="🕰️" title="Lifetime Timeline" sub="Every action, note & snapshot — chronologically"/>

      {/* Add Manual Note */}
      <Card glow={C.purple}>
        <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:8}}>📝 Log Event Now</div>
        <div style={{display:"flex",gap:8}}>
          <input value={addNote} onChange={e=>setAddNote(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addManualNote()}
            style={IS} placeholder="What just happened? (press Enter)"/>
          <button onClick={addManualNote} style={{background:C.purple,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:800,cursor:"pointer",fontSize:12,whiteSpace:"nowrap"}}>{adding?"...":"+ Log"}</button>
        </div>
      </Card>

      {/* Controls */}
      <Card glow={C.blue}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {CATS.map(c=>(
            <button key={c.id} onClick={()=>setFilter(c.id)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${filter===c.id?C.blue:"rgba(255,255,255,0.1)"}`,background:filter===c.id?`${C.blue}22`:"transparent",color:filter===c.id?C.blue:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} style={IS} placeholder="🔍 Search timeline..."/>
          <select value={dateRange} onChange={e=>setDateRange(Number(e.target.value))} style={{...IS,width:100}}>
            <option value={1}>Today</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </Card>

      {loading&&<div style={{color:C.muted,textAlign:"center",padding:20,fontSize:12}}>Loading timeline...</div>}

      {!loading&&Object.keys(grouped).length===0&&(
        <Card><div style={{color:C.muted,fontSize:12,textAlign:"center"}}>No events found. Start logging activities to build your timeline!</div></Card>
      )}

      {!loading&&Object.keys(grouped).map(date=>(
        <div key={date}>
          <div style={{color:C.gold,fontWeight:800,fontSize:11,letterSpacing:1,textTransform:"uppercase",padding:"8px 0 4px"}}>{date}</div>
          {grouped[date].map((ev,i)=>(
            <div key={ev.id||i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:28,height:28,borderRadius:8,background:`${cc(ev.cat)}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{ev.icon||"📌"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:C.text,fontSize:13,fontWeight:600}}>{ev.label||ev.action||"Event"}</div>
                {ev.detail&&<div style={{color:C.muted,fontSize:11,marginTop:1}}>{ev.detail}</div>}
                <div style={{color:cc(ev.cat),fontSize:10,marginTop:2}}>{ev.ts?new Date(ev.ts).toLocaleTimeString():"—"}</div>
              </div>
              <div style={{flexShrink:0,background:`${cc(ev.cat)}15`,borderRadius:6,padding:"2px 7px",height:"fit-content",alignSelf:"center"}}>
                <span style={{color:cc(ev.cat),fontSize:10,fontWeight:700}}>{ev.cat||"event"}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Digital Brain Tab (Version History + Snapshots + Comparison + Archive) ────
function ArtifactHistory(){
  const{data}=useEC();
  const[snapshots,setSnapshots]=useState([]);
  const[loading,setLoading]=useState(true);
  const[treeView,setTreeView]=useState("year");
  const[selectedYear,setSelectedYear]=useState(String(new Date().getFullYear()));
  const[selectedMonth,setSelectedMonth]=useState(null);
  const[selectedWeek,setSelectedWeek]=useState(null);
  const[selectedType,setSelectedType]=useState("all");
  const[openSnap,setOpenSnap]=useState(null);
  const[openSnapData,setOpenSnapData]=useState(null);
  const[compareA,setCompareA]=useState(null);
  const[compareB,setCompareB]=useState(null);
  const[compareAData,setCompareAData]=useState(null);
  const[compareBData,setCompareBData]=useState(null);
  const[showCompare,setShowCompare]=useState(false);
  const[delConfirm,setDelConfirm]=useState(null);
  const[search,setSearch]=useState("");
  const[msg,setMsg]=useState("");

  const load=async()=>{
    setLoading(true);
    const master=await loadAllSnapshots();
    setSnapshots(master||[]);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const openFull=async(s)=>{
    const full=await loadSnapshotFull(s.uid);
    setOpenSnap(s);setOpenSnapData(full);
  };

  const doDelete=async(uid)=>{
    await deleteSnapshot(uid);
    setDelConfirm(null);setOpenSnap(null);setOpenSnapData(null);
    setMsg("🗑️ Deleted.");setTimeout(()=>setMsg(""),2000);
    await load();
  };

  const doCompare=async()=>{
    if(!compareA||!compareB){setMsg("Select 2 snapshots to compare.");return;}
    const [fa,fb]=await Promise.all([loadSnapshotFull(compareA.uid),loadSnapshotFull(compareB.uid)]);
    setCompareAData(fa);setCompareBData(fb);setShowCompare(true);
  };

  const exportSnap=async(s)=>{
    const full=await loadSnapshotFull(s.uid);
    const blob=new Blob([JSON.stringify(full,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`Snapshot_${s.title.replace(/\s+/g,"_")}_${s.date}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  };

  const exportPDF=async(s)=>{
    const full=await loadSnapshotFull(s.uid);
    if(!full)return;
    const html=`<!DOCTYPE html><html><head><title>${full.title}</title>
    <style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#fff;color:#222;}
    h1{color:#FF6B35;}h2{color:#3B82F6;margin-top:20px;}pre{background:#f5f5f5;padding:10px;border-radius:4px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;}
    .meta{background:#f0f7ff;padding:10px;border-radius:6px;font-size:12px;margin-bottom:16px;}
    </style></head><body>
    <h1>📸 ${full.title}</h1>
    <div class="meta">
      <b>Date:</b> ${full.date} &nbsp;|&nbsp; <b>Type:</b> ${full.type} &nbsp;|&nbsp;
      <b>Week:</b> ${full.weekNum||"—"} &nbsp;|&nbsp; <b>Month:</b> ${full.month||"—"} &nbsp;|&nbsp;
      <b>Quarter:</b> ${full.quarter||"—"} &nbsp;|&nbsp; <b>Year:</b> ${full.year||"—"}<br>
      <b>Snapshot ID:</b> ${full.snapId} &nbsp;|&nbsp; <b>Version:</b> ${full.version||"—"}
      ${full.notes?`<br><b>Notes:</b> ${full.notes}`:""}
    </div>
    <h2>Data</h2>
    <pre>${JSON.stringify(full.data,null,2).slice(0,50000)}</pre>
    <p style="color:#999;font-size:11px;margin-top:30px">Generated by Life OS v41 · ${new Date().toLocaleString()}</p>
    </body></html>`;
    const w=window.open("","_blank");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);}
  };

  // Group snapshots into tree
  const byYear={};
  snapshots.forEach(s=>{
    const y=s.year||s.date?.slice(0,4)||"?";
    if(!byYear[y])byYear[y]={weeks:{},months:{},all:[]};
    byYear[y].all.push(s);
    const mo=s.month||s.date?.slice(0,7)||"?";
    if(!byYear[y].months[mo])byYear[y].months[mo]=[];
    byYear[y].months[mo].push(s);
    const wk=s.week||s.date||"?";
    if(!byYear[y].weeks[wk])byYear[y].weeks[wk]=[];
    byYear[y].weeks[wk].push(s);
  });

  const years=Object.keys(byYear).sort().reverse();

  const filtered=snapshots.filter(s=>{
    if(selectedType!=="all"&&s.type!==selectedType)return false;
    if(selectedYear&&(s.year||s.date?.slice(0,4))!==selectedYear)return false;
    if(selectedMonth&&s.month!==selectedMonth)return false;
    if(selectedWeek&&s.week!==selectedWeek)return false;
    if(search&&!JSON.stringify(s).toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const TYPES=["all","daily","weekly","monthly","quarterly","yearly","custom","auto"];
  const MONTHS=["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"];

  const typeColor={daily:C.blue,weekly:C.green,monthly:C.gold,quarterly:C.purple,yearly:C.saffron,custom:C.teal,auto:C.muted};
  const tc=t=>typeColor[t]||C.muted;

  if(showCompare&&compareAData&&compareBData){
    const a=compareAData.data||{};const b=compareBData.data||{};
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];
    const diffs=keys.filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
    const same=keys.length-diffs.length;
    return(
      <div>
        <button onClick={()=>setShowCompare(false)} style={{background:`${C.muted}20`,border:"none",borderRadius:8,padding:"8px 14px",color:C.muted,fontWeight:700,cursor:"pointer",marginBottom:12,fontSize:12}}>← Back</button>
        <Card glow={C.gold}>
          <div style={{color:C.gold,fontWeight:800,fontSize:14,marginBottom:8}}>⚖️ Snapshot Comparison</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{background:`${C.blue}10`,borderRadius:8,padding:8}}>
              <div style={{color:C.blue,fontWeight:700,fontSize:11}}>A: {compareAData.title}</div>
              <div style={{color:C.muted,fontSize:10}}>{compareAData.date} · {compareAData.type}</div>
            </div>
            <div style={{background:`${C.green}10`,borderRadius:8,padding:8}}>
              <div style={{color:C.green,fontWeight:700,fontSize:11}}>B: {compareBData.title}</div>
              <div style={{color:C.muted,fontSize:10}}>{compareBData.date} · {compareBData.type}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:10}}>
            <div style={{background:`${C.green}15`,borderRadius:8,padding:"6px 12px"}}><span style={{color:C.green,fontWeight:800}}>{same}</span><span style={{color:C.muted,fontSize:11}}> same</span></div>
            <div style={{background:`${C.gold}15`,borderRadius:8,padding:"6px 12px"}}><span style={{color:C.gold,fontWeight:800}}>{diffs.length}</span><span style={{color:C.muted,fontSize:11}}> changed</span></div>
          </div>
          {diffs.length===0&&<div style={{color:C.green,fontSize:13,fontWeight:700}}>✅ Snapshots are identical.</div>}
          {diffs.map((k,i)=>(
            <div key={i} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:8,marginBottom:6}}>
              <div style={{color:C.gold,fontSize:11,fontWeight:800,marginBottom:4}}>🔑 {k}</div>
              <div style={{color:C.red,fontSize:10,marginBottom:2}}>A: {JSON.stringify(a[k])?.slice(0,120)}…</div>
              <div style={{color:C.green,fontSize:10}}>B: {JSON.stringify(b[k])?.slice(0,120)}…</div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if(openSnap&&openSnapData){
    return(
      <div>
        <button onClick={()=>{setOpenSnap(null);setOpenSnapData(null);}} style={{background:`${C.muted}20`,border:"none",borderRadius:8,padding:"8px 14px",color:C.muted,fontWeight:700,cursor:"pointer",marginBottom:12,fontSize:12}}>← Back</button>
        <Card glow={C.blue}>
          <div style={{color:C.blue,fontWeight:800,fontSize:14,marginBottom:4}}>📸 {openSnapData.title}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {[["📅",openSnapData.date],["📆",openSnapData.type],["🗓️","W"+openSnapData.weekNum],["📊",openSnapData.month],["🏷️",openSnapData.quarter]].map(([ic,v],i)=>v&&(
              <div key={i} style={{background:"rgba(255,255,255,0.05)",borderRadius:6,padding:"3px 8px",fontSize:10,color:C.muted}}>{ic} {v}</div>
            ))}
          </div>
          {openSnapData.notes&&<div style={{color:C.text,fontSize:12,marginBottom:8,background:"rgba(255,255,255,0.03)",borderRadius:6,padding:8}}>{openSnapData.notes}</div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            <button onClick={()=>exportSnap(openSnap)} style={{background:`${C.green}15`,border:`1px solid ${C.green}30`,borderRadius:8,padding:"6px 12px",color:C.green,fontWeight:700,cursor:"pointer",fontSize:11}}>📥 Export JSON</button>
            <button onClick={()=>exportPDF(openSnap)} style={{background:`${C.gold}15`,border:`1px solid ${C.gold}30`,borderRadius:8,padding:"6px 12px",color:C.gold,fontWeight:700,cursor:"pointer",fontSize:11}}>📄 Export PDF</button>
            <button onClick={()=>{setCompareA(compareA?compareA:openSnap);setCompareB(compareA?openSnap:null);setOpenSnap(null);setOpenSnapData(null);}} style={{background:`${C.purple}15`,border:`1px solid ${C.purple}30`,borderRadius:8,padding:"6px 12px",color:C.purple,fontWeight:700,cursor:"pointer",fontSize:11}}>⚖️ {compareA?"Compare B":"Compare A"}</button>
            {delConfirm===openSnap.uid?(
              <button onClick={()=>doDelete(openSnap.uid)} style={{background:`${C.red}25`,border:`1px solid ${C.red}50`,borderRadius:8,padding:"6px 12px",color:C.red,fontWeight:800,cursor:"pointer",fontSize:11}}>⚠️ Confirm Delete</button>
            ):(
              <button onClick={()=>setDelConfirm(openSnap.uid)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 12px",color:C.muted,fontWeight:700,cursor:"pointer",fontSize:11}}>🗑️ Delete</button>
            )}
          </div>
          <div style={{color:C.muted,fontSize:10,marginBottom:6}}>SNAPSHOT DATA KEYS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {Object.keys(openSnapData.data||{}).map((k,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:5,padding:"2px 7px",fontSize:10,color:C.muted}}>{k}</div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return(
    <div>
      {msg&&<div style={{background:`${C.green}15`,border:`1px solid ${C.green}30`,borderRadius:8,padding:"8px 12px",color:C.green,fontSize:12,fontWeight:700,marginBottom:10}}>{msg}</div>}

      {/* Search + Compare bar */}
      <Card glow={C.blue}>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} style={IS} placeholder="🔍 Search all snapshots..."/>
          {compareA&&!compareB&&<div style={{color:C.muted,fontSize:11,alignSelf:"center",whiteSpace:"nowrap"}}>A: {compareA.title?.slice(0,20)}</div>}
          {compareA&&compareB&&(
            <button onClick={doCompare} style={{background:C.gold,color:"#000",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:800,cursor:"pointer",fontSize:11,whiteSpace:"nowrap"}}>⚖️ Compare</button>
          )}
          {(compareA||compareB)&&<button onClick={()=>{setCompareA(null);setCompareB(null);}} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"6px 10px",color:C.muted,cursor:"pointer",fontSize:11}}>✕</button>}
        </div>
        {/* Type filter */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {TYPES.map(t=>(
            <button key={t} onClick={()=>setSelectedType(t)} style={{padding:"4px 9px",borderRadius:7,border:`1px solid ${selectedType===t?tc(t):"rgba(255,255,255,0.1)"}`,background:selectedType===t?tc(t)+"20":"transparent",color:selectedType===t?tc(t):C.muted,fontSize:10,fontWeight:700,cursor:"pointer"}}>{t}</button>
          ))}
        </div>
      </Card>

      {/* Tree Navigation */}
      <Card glow={C.gold}>
        <div style={{color:C.gold,fontWeight:800,fontSize:12,marginBottom:8}}>📁 Artifact History Tree</div>
        {loading&&<div style={{color:C.muted,fontSize:12}}>Loading...</div>}
        {!loading&&years.length===0&&<div style={{color:C.muted,fontSize:12}}>No snapshots yet. Save your first snapshot!</div>}
        {years.map(yr=>(
          <div key={yr}>
            <button onClick={()=>setSelectedYear(selectedYear===yr?null:yr)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:selectedYear===yr?`${C.gold}12`:"transparent",border:"none",borderRadius:8,padding:"7px 8px",cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:12}}>{selectedYear===yr?"▼":"▶"}</span>
              <span style={{color:C.gold,fontWeight:800,fontSize:13}}>📅 {yr}</span>
              <span style={{color:C.muted,fontSize:10,marginLeft:"auto"}}>{byYear[yr]?.all.length} snapshots</span>
            </button>
            {selectedYear===yr&&(
              <div style={{paddingLeft:16}}>
                {/* Months */}
                <div style={{color:C.muted,fontSize:9,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>BY MONTH</div>
                {Object.keys(byYear[yr]?.months||{}).sort().reverse().map(mo=>(
                  <div key={mo}>
                    <button onClick={()=>setSelectedMonth(selectedMonth===mo?null:mo)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:selectedMonth===mo?`${C.purple}10`:"transparent",border:"none",borderRadius:6,padding:"5px 6px",cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:11}}>{selectedMonth===mo?"▼":"▶"}</span>
                      <span style={{color:C.purple,fontWeight:700,fontSize:12}}>📆 {mo}</span>
                      <span style={{color:C.muted,fontSize:10,marginLeft:"auto"}}>{byYear[yr].months[mo].length}</span>
                    </button>
                    {selectedMonth===mo&&(
                      <div style={{paddingLeft:14}}>
                        {byYear[yr].months[mo].map((s,i)=>(
                          <button key={i} onClick={()=>openFull(s)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:"none",borderRadius:5,padding:"4px 4px",cursor:"pointer",textAlign:"left"}}>
                            <span style={{color:tc(s.type),fontSize:10}}>📸</span>
                            <span style={{color:C.text,fontSize:11,flex:1}}>{s.title}</span>
                            <span style={{color:C.muted,fontSize:9}}>{s.date}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {/* Weeks */}
                <div style={{color:C.muted,fontSize:9,letterSpacing:1,textTransform:"uppercase",margin:"8px 0 4px"}}>BY WEEK</div>
                {Object.keys(byYear[yr]?.weeks||{}).sort().reverse().slice(0,8).map(wk=>(
                  <div key={wk}>
                    <button onClick={()=>setSelectedWeek(selectedWeek===wk?null:wk)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:selectedWeek===wk?`${C.green}10`:"transparent",border:"none",borderRadius:6,padding:"5px 6px",cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:11}}>{selectedWeek===wk?"▼":"▶"}</span>
                      <span style={{color:C.green,fontWeight:700,fontSize:12}}>🗓️ {wk}</span>
                      <span style={{color:C.muted,fontSize:10,marginLeft:"auto"}}>{byYear[yr].weeks[wk].length}</span>
                    </button>
                    {selectedWeek===wk&&(
                      <div style={{paddingLeft:14}}>
                        {byYear[yr].weeks[wk].map((s,i)=>(
                          <button key={i} onClick={()=>openFull(s)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:"none",borderRadius:5,padding:"4px 4px",cursor:"pointer",textAlign:"left"}}>
                            <span style={{color:tc(s.type),fontSize:10}}>📸</span>
                            <span style={{color:C.text,fontSize:11,flex:1}}>{s.title}</span>
                            <span style={{color:C.muted,fontSize:9}}>{s.date}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Flat list filtered */}
      {filtered.length>0&&(
        <Card glow={C.teal}>
          <div style={{color:C.teal,fontWeight:800,fontSize:12,marginBottom:8}}>📋 {filtered.length} Snapshots {selectedType!=="all"&&`(${selectedType})`}</div>
          {filtered.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:tc(s.type),flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>{s.title}</div>
                <div style={{color:C.muted,fontSize:10}}>{s.date} · {s.type} · W{s.weekNum||"?"}</div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>openFull(s)} style={{background:`${C.blue}15`,border:`1px solid ${C.blue}25`,borderRadius:6,padding:"4px 8px",color:C.blue,fontSize:10,cursor:"pointer",fontWeight:700}}>View</button>
                <button onClick={()=>exportSnap(s)} style={{background:`${C.green}15`,border:`1px solid ${C.green}25`,borderRadius:6,padding:"4px 8px",color:C.green,fontSize:10,cursor:"pointer",fontWeight:700}}>JSON</button>
                <button onClick={()=>exportPDF(s)} style={{background:`${C.gold}15`,border:`1px solid ${C.gold}25`,borderRadius:6,padding:"4px 8px",color:C.gold,fontSize:10,cursor:"pointer",fontWeight:700}}>PDF</button>
                <button onClick={()=>{setCompareA(compareA?compareA:s);setCompareB(compareA?s:null);}} style={{background:`${C.purple}15`,border:`1px solid ${C.purple}25`,borderRadius:6,padding:"4px 8px",color:C.purple,fontSize:10,cursor:"pointer",fontWeight:700}}>⚖️</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function DigitalBrainTab(){
  const{data}=useEC();
  const[view,setView]=useState("history");
  const[exporting,setExporting]=useState(false);
  const[importText,setImportText]=useState("");
  const[importMsg,setImportMsg]=useState("");
  const[snapshotMsg,setSnapshotMsg]=useState("");
  const[vhKey,setVhKey]=useState("life-os-primary");
  const[vhList,setVhList]=useState([]);
  const[archiveItems,setArchiveItems]=useState([]);
  const[archSearch,setArchSearch]=useState("");
  const[snapCount,setSnapCount]=useState(0);

  useEffect(()=>{
    loadAllSnapshots().then(m=>setSnapCount((m||[]).length));
    stList("archivefull-").then(async keys=>{
      const tabKeys=await stList("archivetab-");
      setArchiveItems([...keys,...tabKeys].slice(0,100));
    });
  },[]);
  useEffect(()=>{
    stGet("vh-"+vhKey).then(v=>setVhList(Array.isArray(v)?v.slice(0,50):[]));
  },[vhKey]);

  const takeSnapshot=async(type)=>{
    setSnapshotMsg("Saving...");
    const uid=await saveSnapshot(data,{type:type||"custom"});
    setSnapshotMsg(uid?"✅ Saved!":"❌ Failed");
    setTimeout(()=>setSnapshotMsg(""),2500);
    loadAllSnapshots().then(m=>setSnapCount((m||[]).length));
  };

  const exportDatabase=async()=>{
    setExporting(true);
    try{
      const full=await DataManager.exportFull(data,"Full DB Export v41");
      const blob=new Blob([JSON.stringify(full,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`LifeOS_v41_Backup_${todayStr()}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }catch(e){console.error("export failed",e);}
    setExporting(false);
  };

  const doImport=async()=>{
    const result=await DataManager.importData(importText);
    if(result.ok){setImportMsg("✅ Import merged! Data saved to all 3 copies.");}
    else{setImportMsg("❌ Invalid JSON: "+result.error);}
  };

  const VIEWS=[
    {id:"history",label:"📁 Artifact History"},
    {id:"save",label:"📸 Save Snapshot"},
    {id:"vhistory",label:"🔄 Version Log"},
    {id:"archive",label:"🗃️ Archive"},
    {id:"backup",label:"💾 Backup"},
  ];

  return(
    <div>
      <SectionTitle icon="🧬" title="Digital Brain" sub="Permanent history · snapshots · archive · backup"/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {VIEWS.map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{padding:"6px 11px",borderRadius:9,border:`1px solid ${view===v.id?C.purple:"rgba(255,255,255,0.1)"}`,background:view===v.id?`${C.purple}20`:"transparent",color:view===v.id?C.purple:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {v.label}
          </button>
        ))}
      </div>

      {view==="history"&&<ArtifactHistory/>}

      {view==="save"&&(
        <div>
          <Card glow={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:13,marginBottom:4}}>📸 Save Snapshot</div>
            <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Each save creates a NEW permanent record. Nothing is ever overwritten.</div>
            {snapshotMsg&&<div style={{color:C.green,fontWeight:700,fontSize:12,marginBottom:8}}>{snapshotMsg}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {type:"daily",label:"📅 Save Today",color:C.blue,detail:"Saves today's complete Life OS state"},
                {type:"weekly",label:"🗓️ Save This Week",color:C.green,detail:"Permanent weekly record — stays forever"},
                {type:"monthly",label:"📆 Save This Month",color:C.gold,detail:"Full monthly snapshot with all data"},
                {type:"quarterly",label:"📊 Save This Quarter",color:C.purple,detail:"Quarterly review snapshot"},
                {type:"yearly",label:"🏆 Save This Year",color:C.saffron,detail:"Annual record — full year snapshot"},
                {type:"custom",label:"⭐ Custom Snapshot",color:C.teal,detail:"Save right now with a custom label"},
              ].map((s,i)=>(
                <button key={i} onClick={()=>takeSnapshot(s.type)} style={{background:`${s.color}12`,border:`1px solid ${s.color}30`,borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left"}}>
                  <div style={{color:s.color,fontWeight:800,fontSize:13}}>{s.label}</div>
                  <div style={{color:C.muted,fontSize:11,marginTop:2}}>{s.detail}</div>
                </button>
              ))}
            </div>
          </Card>
          <Card glow={C.gold}>
            <div style={{color:C.gold,fontWeight:800,fontSize:12,marginBottom:6}}>📋 Total Snapshots: {snapCount}</div>
            <div style={{color:C.muted,fontSize:11}}>Every snapshot is stored permanently until you explicitly delete it. Browse them in Artifact History.</div>
          </Card>
        </div>
      )}

      {view==="vhistory"&&(
        <div>
          <Card glow={C.purple}>
            <div style={{color:C.purple,fontWeight:800,fontSize:13,marginBottom:8}}>🔄 Version History Browser</div>
            <input value={vhKey} onChange={e=>setVhKey(e.target.value)} style={IS} placeholder="Storage key..."/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
              {["life-os-primary","tl-"+todayStr()].map(k=>(
                <button key={k} onClick={()=>setVhKey(k)} style={{background:`${C.purple}15`,border:`1px solid ${C.purple}30`,borderRadius:7,padding:"4px 9px",color:C.purple,fontSize:10,cursor:"pointer"}}>{k.slice(0,30)}</button>
              ))}
            </div>
          </Card>
          {vhList.length===0&&<Card><div style={{color:C.muted,fontSize:12}}>No version history for this key. Changes will be recorded automatically going forward.</div></Card>}
          {vhList.map((v,i)=>(
            <div key={i} style={{background:"rgba(139,92,246,0.04)",border:`1px solid ${C.purple}18`,borderRadius:10,padding:10,marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{color:C.purple,fontSize:11,fontWeight:700}}>{v.action||"edit"}</div>
                <div style={{color:C.muted,fontSize:10}}>{v.date} · {v.ts?new Date(v.ts).toLocaleTimeString():"—"}</div>
              </div>
              <div style={{color:C.muted,fontSize:10}}>ID: {v.vid?.slice(0,20)||"—"}</div>
            </div>
          ))}
        </div>
      )}

      {view==="archive"&&(
        <div>
          <Card glow={C.teal}>
            <div style={{color:C.teal,fontWeight:800,fontSize:13,marginBottom:8}}>🗃️ Archive ({archiveItems.length})</div>
            <input value={archSearch} onChange={e=>setArchSearch(e.target.value)} style={IS} placeholder="🔍 Search..."/>
          </Card>
          {archiveItems.filter(k=>!archSearch||k.includes(archSearch)).map((k,i)=>(
            <div key={i} style={{background:"rgba(20,184,166,0.04)",border:`1px solid ${C.teal}18`,borderRadius:10,padding:10,marginBottom:6}}>
              <div style={{color:C.teal,fontSize:11,fontWeight:700}}>{k}</div>
            </div>
          ))}
        </div>
      )}

      {view==="backup"&&(
        <div>
          <Card glow={C.green}>
            <div style={{color:C.green,fontWeight:800,fontSize:13,marginBottom:8}}>💾 Export Full Database</div>
            <button onClick={exportDatabase} style={{background:C.green,color:"#000",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:800,cursor:"pointer",fontSize:12,width:"100%"}}>{exporting?"Exporting...":"⬇️ Download Backup JSON"}</button>
          </Card>
          <Card glow={C.saffron}>
            <div style={{color:C.saffron,fontWeight:800,fontSize:13,marginBottom:8}}>📥 Import / Merge Backup</div>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} style={{...IS,minHeight:80,resize:"vertical"}} placeholder="Paste JSON backup..."/>
            <button onClick={doImport} style={{background:C.saffron,color:"#000",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:800,cursor:"pointer",fontSize:12,marginTop:8,width:"100%"}}>📥 Import & Merge</button>
            {importMsg&&<div style={{color:importMsg.startsWith("✅")?C.green:C.red,fontSize:12,marginTop:8,fontWeight:700}}>{importMsg}</div>}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP v39 — DataManager-Powered ───────────────────────────────────────
let activeGroup = "home";

export default function App() {
  const [tab, setTab]         = useState("command");
  const [group, setGroup]     = useState("home");
  const [em, setEm]           = useState(false);
  const [data, setData]       = useState(DEF);
  const [loaded, setLoaded]   = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); // "saving"|"saved"|"error"|""
  const [showPDFModal, setShowPDFModal]     = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [showCommand, setShowCommand]       = useState(false);
  const [showToday, setShowToday]           = useState(false);
  const [showWorkspace, setShowWorkspace]   = useState(false);
  const [bootStatus, setBootStatus]         = useState("booting"); // "booting"|"ok"|"fresh"|"error"

  activeGroup = group;

  // ── Boot sequence ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await DataManager.boot();
        if (result?.data) {
          setData({ ...DEF, ...result.data });
          setBootStatus("ok");
          // Restore navigation
          if (result.nav) {
            if (result.nav.group) setGroup(result.nav.group);
            if (result.nav.tab)   setTab(result.nav.tab);
            if (result.nav.group && result.nav.group !== "home" && !result.nav.tab) setShowWorkspace(true);
          }
          // Auto daily snapshot (runs after UI is ready)
          setTimeout(() => snapshotToday(result.data), 2000);
          // Auto backups (daily/weekly/monthly — non-blocking)
          setTimeout(() => DataManager.runAutoBackups(result.data), 4000);
        } else {
          setBootStatus("fresh");
        }
      } catch (e) {
        console.error("[App] boot error", e);
        setBootStatus("error");
      }
      setLoaded(true);
    })();

    // Subscribe to DataManager status updates
    const unsub = DataManager.subscribe(({ status }) => {
      if (status === "saving") setSaveStatus("saving");
      else if (status === "saved") setSaveStatus("saved");
      else if (status === "error") setSaveStatus("error");
    });
    return unsub;
  }, []);

  // ── Edit handler — save FIRST, then update cache ───────────────────────────
  const handleSet = async (path, value) => {
    setSaveStatus("saving");
    // Record version history
    vhRecord(path, data[path], value, "edit");
    // Patch via DataManager (writes to storage, then returns updated object)
    const updated = await DataManager.patch(path, value, data);
    setData(updated); // update UI cache AFTER successful save
  };

  // ── Archive / restore helpers ──────────────────────────────────────────────
  const archiveTabNow = async (tabId) => {
    const today = todayStr();
    const info = TABS.find(t => t.id === tabId) || { label: tabId };
    await stSet(archiveTabKey(tabId, today), { date: today, tab: tabId, label: info.label, savedAt: Date.now() });
  };
  const restoreAll = async (snapshotData) => {
    const merged = { ...DEF, ...snapshotData };
    await DataManager.save(merged);
    setData(merged);
  };
  const restoreTab = async (tabId, tabData) => {
    const updated = { ...data, [tabId]: tabData };
    await DataManager.save(updated);
    setData(updated);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = (newTab, newGroup) => {
    setTab(newTab); setGroup(newGroup); setShowWorkspace(false);
    DataManager.saveNav(newTab, newGroup);
  };
  const handleGroupChange = (gid) => {
    if (gid === "home") {
      setGroup("home"); setShowWorkspace(false);
      DataManager.saveNav(tab, "home");
    } else {
      const grp = TAB_GROUPS.find(g => g.id === gid);
      setGroup(gid); setShowWorkspace(true);
      if (grp?.tabs[0]) setTab(grp.tabs[0].id);
      DataManager.saveNav(grp?.tabs[0]?.id || tab, gid);
    }
  };
  const handleTabChange = (tid) => {
    setTab(tid); setShowWorkspace(false);
    DataManager.saveNav(tid, group);
  };

  const grpColor = TAB_GROUPS.find(g => g.id === group)?.color || C.saffron;
  const currentTabInfo = TABS.find(t => t.id === tab);

  const renderMain = () => {
    if (group === "home")     return <HomeDashboardV36 onNavigate={navigate} onTodayMode={() => setShowToday(true)} />;
    if (showWorkspace)        return <WorkspaceDashboard group={group} onNavigate={(t,g) => { setTab(t); setGroup(g); setShowWorkspace(false); }} />;
    if (tab === "command")    return <CommandCenterTab />;
    if (tab === "countdown")  return <SmartCountdownTab />;
    if (tab === "pomodoro")   return <PomodoroTab />;
    if (tab === "onetask")    return <ONETaskTab />;
    if (tab === "identity")   return <IdentityTab />;
    if (tab === "schedule")   return <ScheduleTab />;
    if (tab === "study")      return <StudyTab />;
    if (tab === "health")     return <HealthTab />;
    if (tab === "money")      return <MoneyTab />;
    if (tab === "myday")      return <MyDayTab />;
    if (tab === "tracker")    return <TrackerTab />;
    if (tab === "progress")   return <ProgressTab />;
    if (tab === "scorecard")  return <ScorecardTab />;
    if (tab === "digital")    return <DigitalTab />;
    if (tab === "checklist")  return <ChecklistTab />;
    if (tab === "masterplan") return <MasterMatrixTab />;
    if (tab === "analytics")  return <AnalyticsTab />;
    if (tab === "flow")       return <FlowStateTab />;
    if (tab === "vitality")   return <VitalityTab />;
    if (tab === "voicenotes") return <VoiceNotesTab />;
    if (tab === "selfctrl")   return <SelfControlTab />;
    if (tab === "content")    return <ContentPlanTab />;
    if (tab === "ideas")      return <IdeasTab />;
    if (tab === "metrics")    return <MetricsTab />;
    if (tab === "mcqtracker") return <MCQTrackerTab />;
    if (tab === "mistakebook") return <MistakeBookTab />;
    if (tab === "pyqtracker") return <PYQTrackerTab />;
    if (tab === "habitheatmap") return <HabitHeatmapTab />;
    if (tab === "reflection") return <ReflectionTab />;
    if (tab === "ceoreview")  return <WeeklyCEOReviewTab />;
    if (tab === "spiritual")  return <SpiritualGrowthTab />;
    if (tab === "environment") return <EnvironmentDesignTab />;
    if (tab === "knowledge")  return <KnowledgeManagementTab />;
    if (tab === "happiness")  return <HappinessTab />;
    if (tab === "finance")    return <MahindraTab />;
    if (tab === "community")  return <CommunityTab />;
    if (tab === "storage")    return <StorageTab />;
    if (tab === "quickref")   return <QuickRefTab />;
    if (tab === "timeline")   return <LifetimeTimelineTab />;
    if (tab === "brain")      return <DigitalBrainTab />;
    return null;
  };

  if (!loaded) return <LoadingScreen />;

  const bottomPad = group === "home" ? 80 : 130;

  // Save indicator icon
  const saveIcon = saveStatus === "saving" ? "●" : saveStatus === "saved" ? "✓" : saveStatus === "error" ? "⚠" : null;
  const saveColor = saveStatus === "saving" ? C.muted : saveStatus === "saved" ? C.green : C.red;

  return (
    <EC.Provider value={{ em, data, set: handleSet, tab, archiveTabNow, restoreAll, restoreTab }}>
      <div style={{ background: "linear-gradient(135deg,#0a0a0f 0%,#111122 100%)", minHeight: "100dvh", fontFamily: "'Inter',system-ui,sans-serif", color: C.text, overscrollBehavior: "none" }}>
        <style>{`
          input,select,textarea{font-size:max(16px,1em);outline:none;}
          ::-webkit-scrollbar{display:none;}
          *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
          input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:rgba(255,255,255,0.1);}
          input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#FF6B35;cursor:pointer;}
          @keyframes spin{to{transform:rotate(360deg);}}
          @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
          .page{animation:fadeUp 0.18s ease;}
          @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        `}</style>

        {/* OVERLAYS */}
        {showSearch  && <GlobalSearch onNavigate={navigate} onClose={() => setShowSearch(false)} />}
        {showCommand && <CommandPalette onNavigate={navigate} onClose={() => setShowCommand(false)} />}
        {showToday   && <TodayMode onNavigate={(t,g) => { navigate(t,g); setShowToday(false); }} onExit={() => setShowToday(false)} />}
        {showPDFModal && <PDFModal onClose={() => setShowPDFModal(false)} data={data} tab={tab} />}

        {/* BOOT STATUS BANNER */}
        {bootStatus === "fresh" && (
          <div style={{ background: `${C.gold}18`, borderBottom: `1px solid ${C.gold}40`, padding: "6px 14px", fontSize: 11, color: C.gold, fontWeight: 700 }}>
            ✨ Fresh start — no previous data found. All your edits save automatically.
          </div>
        )}
        {bootStatus === "error" && (
          <div style={{ background: `${C.red}18`, borderBottom: `1px solid ${C.red}40`, padding: "6px 14px", fontSize: 11, color: C.red, fontWeight: 700 }}>
            ⚠️ Storage error on load. Data restored from defaults. Check Digital Brain → Backup.
          </div>
        )}

        {/* TOP BAR */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(8,8,16,0.94)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Breadcrumb / Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {group === "home" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, background: `linear-gradient(135deg,${C.saffron},${C.gold})`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎯</div>
                  <div style={{ fontSize: 15, fontWeight: 800, background: `linear-gradient(90deg,${C.saffron},${C.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Life OS</div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setShowWorkspace(true)} style={{ width: 28, height: 28, background: `${grpColor}18`, border: `1px solid ${grpColor}30`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer" }}>
                    {TAB_GROUPS.find(g => g.id === group)?.icon}
                  </button>
                  {!showWorkspace && (
                    <div>
                      <div style={{ fontSize: 9, color: `${grpColor}99`, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1, textTransform: "uppercase" }}>{TAB_GROUPS.find(g => g.id === group)?.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{currentTabInfo?.label || "—"}</div>
                    </div>
                  )}
                  {showWorkspace && <div style={{ fontSize: 13, fontWeight: 700, color: grpColor }}>{TAB_GROUPS.find(g => g.id === group)?.label} Workspace</div>}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!navigator.onLine && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>📴</span>}
              {saveIcon && (
                <span style={{
                  fontSize: saveStatus === "saving" ? 10 : 11,
                  color: saveColor,
                  animation: saveStatus === "saving" ? "pulse 1s infinite" : "none",
                  fontWeight: 700,
                }} title={saveStatus === "error" ? "Save error — data in backup" : saveStatus}>
                  {saveIcon}
                </span>
              )}
              <button onClick={() => setShowToday(true)} style={{ background: `${C.saffron}12`, border: `1px solid ${C.saffron}30`, borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: C.saffron }}>
                ⚡ Today
              </button>
              <button onClick={() => setShowCommand(true)} style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}30`, borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: C.blue }}>
                ⌘
              </button>
              <button onClick={() => setShowPDFModal(true)} style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}30`, borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: C.gold }}>
                ⬇️ Export
              </button>
              <button onClick={() => setEm(!em)} style={{ background: em ? C.gold : `${C.purple}20`, color: em ? "#000" : C.purple, border: `1px solid ${em ? C.gold : C.purple}40`, borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", boxShadow: em ? `0 0 10px ${C.gold}40` : "none" }}>
                {em ? "✅" : "✏️"}
              </button>
            </div>
          </div>

          {em && <div style={{ background: `rgba(244,167,38,0.07)`, borderLeft: `3px solid ${C.gold}`, padding: "5px 10px", borderRadius: "0 8px 8px 0", marginTop: 8, fontSize: 11, color: C.muted }}><span style={{ color: C.gold, fontWeight: 800 }}>✏️ </span>Tap underlined text to edit · ✓ save · ✕ cancel</div>}
        </div>

        {/* MAIN CONTENT */}
        <div className="page" style={{ maxWidth: 680, margin: "0 auto", padding: `14px 14px ${bottomPad}px` }}>
          {renderMain()}
        </div>

        {/* FAB */}
        <FloatingActionButton tab={tab} group={group} onNavigate={navigate} onCommand={() => setShowCommand(true)} />

        {/* BOTTOM NAV */}
        <BottomNav
          activeGroup={group}
          onGroupChange={handleGroupChange}
          currentTab={tab}
          onTabChange={handleTabChange}
          onSearchOpen={() => setShowSearch(true)}
          onCommandOpen={() => setShowCommand(true)}
          onTodayMode={() => setShowToday(true)}
        />
      </div>
    </EC.Provider>
  );
}

// ─── HOME DASHBOARD V36 ───────────────────────────────────────────────────────
function HomeDashboardV36({onNavigate,onTodayMode}){
  const{data}=useEC();
  const[time,setTime]=useState(new Date());
  const[liveData,setLiveData]=useState({health:{},study:{},oneTask:{},pomSessions:0,pomMins:0});
  const[quote,setQuote]=useState("");

  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),30000);return()=>clearInterval(t);},[]);

  useEffect(()=>{
    const quotes=data.philosophyCodes||[];
    if(quotes.length)setQuote(quotes[Math.floor((new Date().getHours()+new Date().getDate())%quotes.length)]);
    (async()=>{
      const ht=await stGet("health-daily:"+todayStr());
      const sl=await stGet("study-log:"+todayStr());
      const ot=await stGet("onetask:"+todayStr());
      let sess=0,wk=0;
      const pk=await stList("pom-history:");
      for(const k of pk){const v=await stGet(k);if(v&&v.date===todayStr()){sess++;wk+=v.workSecs||0;}}
      setLiveData({health:ht?.data||{},study:sl?.data||{},oneTask:ot||{},pomSessions:sess,pomMins:Math.round(wk/60)});
    })();
  },[]);

  const hr=time.getHours();
  const timeOfDay=hr<6?"🌙 Pre-Dawn":hr<12?"🌅 Morning":hr<17?"☀️ Afternoon":hr<20?"🌇 Evening":"🌙 Night";
  const greeting=hr<5?"Night Warrior 🌙":hr<10?"Good Morning 🌅":hr<15?"Keep Going ☀️":hr<20?"Evening Warrior 🌇":"Night Mode 🌙";
  const subProg=data.subjectProgress||[];
  const avgProg=subProg.length?Math.round(subProg.reduce((s,x)=>s+Number(x.pct||0),0)/subProg.length):0;
  const countdowns=data.examCountdowns||[];
  const daysLeft=countdowns[0]?.date?Math.max(0,Math.ceil((new Date(countdowns[0].date)-new Date())/(1000*60*60*24))):null;

  // Context actions
  const ctxActions=hr<6?[
    {icon:"🍅",label:"Start Pomodoro",tab:"pomodoro",group:"today"},
    {icon:"🔒",label:"Lock ONE Task",tab:"onetask",group:"today"},
  ]:hr<14?[
    {icon:"💧",label:"Log Water",tab:"health",group:"life"},
    {icon:"🎯",label:"MCQ Practice",tab:"mcqtracker",group:"study"},
  ]:hr<20?[
    {icon:"📖",label:"Evening Study",tab:"schedule",group:"study"},
    {icon:"😊",label:"Log Mood",tab:"health",group:"life"},
  ]:[
    {icon:"🪞",label:"Night Reflection",tab:"reflection",group:"mind"},
    {icon:"🔒",label:"Plan Tomorrow",tab:"onetask",group:"today"},
  ];

  const widgets=[
    {icon:"🔒",label:"ONE Task",value:liveData.oneTask?.task?liveData.oneTask.task.slice(0,26)+(liveData.oneTask.task.length>26?"…":""):"Set task →",color:liveData.oneTask?.done?C.green:C.saffron,tab:"onetask",group:"today"},
    {icon:"🍅",label:"Pomodoro",value:liveData.pomSessions>0?`${liveData.pomSessions} done · ${liveData.pomMins}m`:"Start →",color:C.red,tab:"pomodoro",group:"today"},
    {icon:"📚",label:"Study",value:liveData.study?.studyHrs?`${liveData.study.studyHrs}h`:"Log →",color:C.green,tab:"study",group:"study"},
    {icon:"💧",label:"Water",value:liveData.health?.water?`${liveData.health.water} gl`:"Log →",color:C.blue,tab:"health",group:"life"},
    {icon:"😊",label:"Mood",value:liveData.health?.mood?`${liveData.health.mood}/10`:"Log →",color:C.purple,tab:"health",group:"life"},
    {icon:"😴",label:"Sleep",value:liveData.health?.sleep?`${liveData.health.sleep}h`:"Log →",color:C.teal,tab:"health",group:"life"},
  ];

  return(
    <div>
      {/* HERO */}
      <div style={{background:`linear-gradient(135deg,rgba(255,107,53,0.1),rgba(139,92,246,0.07))`,border:`1px solid rgba(255,107,53,0.18)`,borderRadius:20,padding:"18px 18px",marginBottom:12,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-24,right:-24,width:110,height:110,background:`radial-gradient(circle,${C.saffron}10,transparent)`,borderRadius:"50%",pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:3,fontWeight:600}}>{timeOfDay}</div>
            <div style={{fontSize:19,fontWeight:900,color:C.text,marginBottom:4}}>{greeting}, Atul</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.6,maxWidth:"85%"}}>{quote}</div>
          </div>
          <button onClick={onTodayMode} style={{background:`linear-gradient(135deg,${C.saffron},${C.gold})`,border:"none",borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0,marginLeft:10,boxShadow:`0 3px 14px ${C.saffron}40`}}>
            ⚡ Focus
          </button>
        </div>
      </div>

      {/* PROGRESS + COUNTDOWN ROW */}
      <div style={{display:"grid",gridTemplateColumns:daysLeft!==null?"1fr 1fr":"1fr",gap:10,marginBottom:12}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.gold}20`,borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{position:"relative",width:44,height:44,flexShrink:0}}>
            <svg width={44} height={44} style={{transform:"rotate(-90deg)"}}>
              <circle cx={22} cy={22} r={17} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4}/>
              <circle cx={22} cy={22} r={17} fill="none" stroke={C.gold} strokeWidth={4}
                strokeDasharray={`${(avgProg/100)*106.8} 106.8`} strokeLinecap="round"/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:C.gold}}>{avgProg}%</div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.text}}>Study Progress</div>
            <div style={{fontSize:10,color:C.muted,marginTop:1}}>{subProg.filter(s=>Number(s.pct)>=80).length}/{subProg.length} subjects strong</div>
          </div>
        </div>
        {daysLeft!==null&&(
          <button onClick={()=>onNavigate("countdown","today")} style={{background:"rgba(255,107,53,0.06)",border:`1px solid ${C.saffron}25`,borderRadius:16,padding:"14px",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>COUNTDOWN</div>
            <div style={{fontSize:30,fontWeight:900,color:C.saffron,lineHeight:1}}>{daysLeft}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{countdowns[0]?.label?.slice(0,18)||"Exam"} →</div>
          </button>
        )}
      </div>

      {/* WIDGETS GRID */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {widgets.map((w,i)=>(
          <button key={i} onClick={()=>onNavigate(w.tab,w.group)} style={{
            background:"rgba(255,255,255,0.03)",border:`1px solid ${w.color}15`,
            borderRadius:14,padding:"12px 8px",cursor:"pointer",textAlign:"center",
            WebkitTapHighlightColor:"transparent",
          }}>
            <div style={{fontSize:18}}>{w.icon}</div>
            <div style={{color:w.color,fontWeight:800,fontSize:13,marginTop:4,lineHeight:1.2}}>{w.value}</div>
            <div style={{color:C.muted,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:0.5}}>{w.label}</div>
          </button>
        ))}
      </div>

      {/* CONTEXT ACTIONS */}
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"14px",marginBottom:12}}>
        <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>⚡ RIGHT NOW</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {ctxActions.map((a,i)=>(
            <button key={i} onClick={()=>onNavigate(a.tab,a.group)} style={{
              display:"flex",alignItems:"center",gap:10,
              background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:12,padding:"10px 12px",cursor:"pointer",textAlign:"left",
              WebkitTapHighlightColor:"transparent",
            }}>
              <span style={{fontSize:16}}>{a.icon}</span>
              <span style={{color:C.text,fontSize:13,fontWeight:600}}>{a.label}</span>
              <span style={{marginLeft:"auto",color:C.muted,fontSize:14}}>→</span>
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE SHORTCUTS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
        {TAB_GROUPS.map(g=>(
          <button key={g.id} onClick={()=>onNavigate(g.tabs[0]?.id||"command",g.id)} style={{
            background:`${g.color}08`,border:`1px solid ${g.color}20`,
            borderRadius:14,padding:"14px 8px",cursor:"pointer",textAlign:"center",
            WebkitTapHighlightColor:"transparent",
          }}>
            <div style={{fontSize:22}}>{g.icon}</div>
            <div style={{color:g.color,fontSize:11,fontWeight:700,marginTop:5,letterSpacing:0.3}}>{g.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
