// Timetable regeneration - period-major compaction + double periods
import mongoose from 'mongoose';
const uri = 'mongodb://manfess_admin:GOLDBLISSZ33@ac-88ksdaw-shard-00-00.bf8h1wy.mongodb.net:27017,ac-88ksdaw-shard-00-01.bf8h1wy.mongodb.net:27017,ac-88ksdaw-shard-00-02.bf8h1wy.mongodb.net:27017/MANFESS?tls=true&authSource=admin&replicaSet=atlas-10fmul-shard-0&retryWrites=true&w=majority';
await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
const db = mongoose.connection.db;
const log = console.log;

const T = { epie:'6a97a00a3c1247098a21e166', evaristus:'6a97a2c89f9c0d8ee43447d4', marvis:'6a97a577909973238d6acbf9', nsoseh:'6a97a5db909973238d6acbfa', yoland:'6a97a66b909973238d6acbfb', euinice:'6a97a702909973238d6acbfc', billa:'6a97a8c4909973238d6acbfe', fortune:'6a97a914909973238d6acbff', ando:'6a97a9c8909973238d6acc00', gildeon:'6a97aa79909973238d6acc03', mercy:'6a97afb5ac4ccdf7ea024cb1', nkimi:'6a97b0d9ac4ccdf7ea024cb3', martin:'6a9856e680277c731bad9591', teacherx:'6a97a806909973238d6acbfd' };
const TN = Object.fromEntries(Object.entries(T).map(([k,v]) => [v,k]));
const C = { B1:'6a9704c85032926f622478fe', B2:'6a97cb51b9515c2fc9126dd1', OL3:'6a970694530d27459070478b', OL4A:'6a9706a5530d27459070478c', OL4C:'6a9706b4530d27459070478d', OL4S:'6a97aa36909973238d6acc02', OL5A:'6a9706c7530d27459070478e', OL5C:'6a9706d7530d27459070478f', OL5S:'6a97aa0e909973238d6acc01', ALSC:'6a97a1e89f9c0d8ee43447d2', ALAR:'6a97a2079f9c0d8ee43447d3' };
const CN = Object.fromEntries(Object.entries(C).map(([k,v]) => [v,k]));
const S = { entr:'6a979e683c1247098a21e165', mkt:'6a97b3f2ac4ccdf7ea024cb4', sm:'6a97b653ac4ccdf7ea024cb5', geo1:'6a97b6eeac4ccdf7ea024cb6', geo2:'6a97b797ac4ccdf7ea024cb7', cit:'6a97b8f4ac4ccdf7ea024cb8', com:'6a97bab1ac4ccdf7ea024cb9', pm:'6a97bb25ac4ccdf7ea024cba', eng1:'6a97ec38d648cdd3b375ff04', eng2:'6a97ed6ad648cdd3b375ff05', lit2:'6a97f07cd648cdd3b375ff06', lit1:'6a97f53e3e41b0fcc3fa1dea', econ1:'6a97f6bd3e41b0fcc3fa1deb', econ2:'6a97f70d3e41b0fcc3fa1dec', hist2:'6a97fafb2953f86db205a79d', hist1:'6a97fb972953f86db205a79e', math:'6a984a4980277c731bad9584', pms:'6a984a8880277c731bad9585', phys2:'6a984ad680277c731bad9586', phys1:'6a984b7080277c731bad9587', cs:'6a984e7a80277c731bad9588', pmm:'6a984ef780277c731bad9589', bizmath:'6a984f9680277c731bad958a', acct:'6a9850a080277c731bad958b', digmkt:'6a98520a80277c731bad958c', chem1:'6a98546b80277c731bad958d', chem2:'6a9854ab80277c731bad958e', bio1:'6a98552880277c731bad958f', bio2:'6a98555680277c731bad9590', fr1:'6a98579b80277c731bad9592', fr2:'6a9857ce80277c731bad9593' };
const SC = new Set([C.OL3, C.ALSC, C.ALAR]);
const P = [[1,'04:30','05:15'],[2,'05:15','06:00'],[3,'06:00','06:45'],[4,'06:45','07:30'],[5,'07:30','08:15'],[6,'08:15','09:00']];
const ACAD = '2026-2027';
const D = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const MW = ['Monday','Wednesday']; const MT = ['Monday','Tuesday']; const TT = ['Tuesday','Thursday'];
const TTF = ['Tuesday','Thursday','Friday']; const MWF = ['Monday','Wednesday','Friday'];
const A5 = D; const MTh = ['Monday','Thursday']; const MD = ['Tuesday','Wednesday','Friday'];
const XD = ['Monday','Tuesday','Wednesday','Thursday'];

const subj = await db.collection('subjects').find({}).toArray();
const clas = await db.collection('schoolclasses').find({}).toArray();
const sN = Object.fromEntries(subj.map(s => [s._id.toString(), s.name]));
const cN = Object.fromEntries(clas.map(c => { const d = c.department || ''; const n = c.className || 'Unknown'; return [c._id.toString(), d ? n+' ('+d+')' : n]; }));

const reqs = [
  // Gildeon - Wed only (6 slots, 5 lessons)
  { t: T.gildeon, s: S.hist2, cls: [C.ALAR], n: 3, days: ['Wednesday'], l: 'Hist ALAR x3' },
  { t: T.gildeon, s: S.hist1, cls: [C.OL5A, C.OL5S], n: 2, days: ['Wednesday'], l: 'Hist OL5 x2' },
  // Yoland - Mon/Tue (12 slots, 10 lessons)
  { t: T.yoland, s: S.chem1, cls: [C.OL4S], n: 2, days: MT, l: 'Chem OL4S x2' },
  { t: T.yoland, s: S.chem1, cls: [C.OL5S], n: 2, days: MT, l: 'Chem OL5S x2' },
  { t: T.yoland, s: S.chem2, cls: [C.ALSC], n: 1, days: MT, l: 'Chem ALSC x1' },
  { t: T.yoland, s: S.bio1, cls: [C.OL3], n: 2, days: MT, l: 'Bio OL3 x2' },
  { t: T.yoland, s: S.bio2, cls: [C.ALSC, C.ALAR], n: 2, days: MT, l: 'Bio AL x2' },
  // Ando - Mon/Wed (12 slots, 9 lessons)
  { t: T.ando, s: S.hist2, cls: [C.ALAR], n: 2, days: MW, l: 'Hist ALAR x2' },
  { t: T.ando, s: S.geo2, cls: [C.ALAR], n: 2, days: MW, l: 'Geo ALAR x2' },
  { t: T.ando, s: S.geo1, cls: [C.OL5A, C.OL5S], n: 2, days: MW, l: 'Geo OL5 x2' },
  { t: T.ando, s: S.cit, cls: [C.OL5A, C.OL5S], n: 2, days: MW, l: 'Cit OL5 x2' },
  // Mercy - Tue/Wed/Fri (18 slots, 18 lessons)
  { t: T.mercy, s: S.eng1, cls: [C.B1, C.B2], n: 2, days: MD, l: 'Eng B1+B2 x2' },
  { t: T.mercy, s: S.eng1, cls: [C.OL3], n: 2, days: MD, l: 'Eng OL3 x2' },
  { t: T.mercy, s: S.eng1, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: MD, l: 'Eng OL4 x2' },
  { t: T.mercy, s: S.eng1, cls: [C.OL5A, C.OL5C, C.OL5S], n: 3, days: MD, l: 'Eng OL5 x3' },
  { t: T.mercy, s: S.eng2, cls: [C.ALAR], n: 3, days: MD, l: 'Eng ALAR x3' },
  { t: T.mercy, s: S.lit1, cls: [C.OL3], n: 2, days: MD, l: 'Lit OL3 x2' },
  { t: T.mercy, s: S.lit1, cls: [C.OL4A, C.OL5A], n: 2, days: MD, l: 'Lit OL4A+OL5A x2' },
  { t: T.mercy, s: S.lit2, cls: [C.ALAR], n: 2, days: MD, l: 'Lit ALAR x2' },
  // Martin - Mon/Wed (12 slots, 12 lessons)
  { t: T.martin, s: S.fr1, cls: [C.B1, C.B2], n: 2, days: MW, l: 'French B1+B2 x2' },
  { t: T.martin, s: S.fr1, cls: [C.OL3], n: 1, days: MW, l: 'French OL3 x1' },
  { t: T.martin, s: S.fr1, cls: [C.OL3, C.ALAR], n: 1, days: MW, l: 'French OL3+ALAR x1' },
  { t: T.martin, s: S.fr1, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: MW, l: 'French OL4 x2' },
  { t: T.martin, s: S.fr1, cls: [C.OL5A, C.OL5C, C.OL5S], n: 3, days: MW, l: 'French OL5 x3' },
  { t: T.martin, s: S.fr2, cls: [C.ALAR], n: 3, days: MW, l: 'French ALAR x3' },
  // teacher x - Mon/Tue/Wed/Thu (24 slots, 6 lessons, 1 double period)
  { t: T.teacherx, s: S.eng1, cls: [C.OL3], n: 1, days: XD, l: 'Eng OL3 x1' },
  { t: T.teacherx, s: S.eng1, cls: [C.OL4A], n: 1, days: XD, l: 'Eng OL4A x1' },
  { t: T.teacherx, s: S.eng1, cls: [C.OL5A], n: 1, days: XD, l: 'Eng OL5A x1' },
  { t: T.teacherx, s: S.lit2, cls: [C.ALAR], n: 2, days: XD, l: 'Lit ALAR x2', dbl: true },
  { t: T.teacherx, s: S.lit1, cls: [C.OL5A], n: 1, days: XD, l: 'Lit OL5A x1' },
  // Nkimi - Mon/Thu (12 slots, 9 lessons)
  { t: T.nkimi, s: S.com, cls: [C.OL5A, C.OL5C, C.OL5S], n: 1, days: MTh, l: 'Com OL5 x1' },
  { t: T.nkimi, s: S.econ1, cls: [C.OL5A, C.OL5C, C.OL5S], n: 2, days: MTh, l: 'Econ OL5 x2' },
  { t: T.nkimi, s: S.econ1, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: MTh, l: 'Econ OL4 x2' },
  { t: T.nkimi, s: S.econ1, cls: [C.OL3], n: 1, days: MTh, l: 'Econ OL3 x1' },
  { t: T.nkimi, s: S.econ2, cls: [C.ALAR], n: 3, days: MTh, l: 'Econ ALAR x3' },
  // Epie - Tue/Thu (12 slots, 9 lessons)
  { t: T.epie, s: S.entr, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: TT, l: 'Entr OL4 x2' },
  { t: T.epie, s: S.entr, cls: [C.OL5A, C.OL5C, C.OL5S], n: 3, days: TT, l: 'Entr OL5 x3' },
  { t: T.epie, s: S.sm, cls: [C.OL4C, C.OL5C], n: 2, days: TT, l: 'SM OL4C+OL5C x2' },
  { t: T.epie, s: S.mkt, cls: [C.OL3], n: 1, days: TT, l: 'Mkt OL3 x1' },
  // Evaristus - Mon/Wed/Fri (18 slots, 9 lessons)
  { t: T.evaristus, s: S.geo1, cls: [C.OL3], n: 2, days: MWF, l: 'Geo OL3 x2' },
  { t: T.evaristus, s: S.geo2, cls: [C.ALAR], n: 2, days: MWF, l: 'Geo ALAR x2' },
  { t: T.evaristus, s: S.cit, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: MWF, l: 'Cit OL4 x2' },
  { t: T.evaristus, s: S.cit, cls: [C.OL3], n: 1, days: MWF, l: 'Cit OL3 x1' },
  { t: T.evaristus, s: S.cit, cls: [C.OL5S], n: 1, days: MWF, l: 'Cit OL5S x1' },
  // Marvis - Tue/Thu (12 slots, 10 lessons)
  { t: T.marvis, s: S.com, cls: [C.OL3], n: 1, days: TT, l: 'Com OL3 x1' },
  { t: T.marvis, s: S.com, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: TT, l: 'Com OL4 x2' },
  { t: T.marvis, s: S.com, cls: [C.OL5A, C.OL5C, C.OL5S], n: 2, days: TT, l: 'Com OL5 x2' },
  { t: T.marvis, s: S.pm, cls: [C.OL4C], n: 2, days: TT, l: 'PM OL4C x2' },
  { t: T.marvis, s: S.pm, cls: [C.OL5C], n: 3, days: TT, l: 'PM OL5C x3' },
  // Eunice - Tue/Thu (12 slots, 10 lessons)
  { t: T.euinice, s: S.chem1, cls: [C.OL5S], n: 1, days: TT, l: 'Chem OL5S x1' },
  { t: T.euinice, s: S.chem1, cls: [C.OL3], n: 1, days: TT, l: 'Chem OL3 x1' },
  { t: T.euinice, s: S.chem2, cls: [C.ALSC], n: 2, days: TT, l: 'Chem ALSC x2' },
  { t: T.euinice, s: S.bio1, cls: [C.OL4S], n: 2, days: TT, l: 'Bio OL4S x2' },
  { t: T.euinice, s: S.bio1, cls: [C.OL5S], n: 2, days: TT, l: 'Bio OL5S x2' },
  { t: T.euinice, s: S.bio2, cls: [C.ALSC], n: 2, days: TT, l: 'Bio ALSC x2' },
  // Billa - Tue/Thu/Fri (18 slots, 16 lessons)
  { t: T.billa, s: S.math, cls: [C.OL3], n: 2, days: TTF, l: 'Maths OL3 x2' },
  { t: T.billa, s: S.math, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: TTF, l: 'Maths OL4 x2' },
  { t: T.billa, s: S.math, cls: [C.OL5A, C.OL5C, C.OL5S], n: 3, days: TTF, l: 'Maths OL5 x3' },
  { t: T.billa, s: S.pms, cls: [C.ALSC, C.ALAR], n: 3, days: TTF, l: 'PMS AL x3' },
  { t: T.billa, s: S.phys1, cls: [C.OL4S], n: 2, days: TTF, l: 'Phys OL4S x2' },
  { t: T.billa, s: S.phys1, cls: [C.OL5S], n: 2, days: TTF, l: 'Phys OL5S x2' },
  // Fortune - Mon-Fri (30 slots, 22 lessons)
  { t: T.fortune, s: S.phys2, cls: [C.ALSC], n: 2, days: A5, l: 'Phys ALSC x2' },
  { t: T.fortune, s: S.phys1, cls: [C.OL5S], n: 2, days: A5, l: 'Phys OL5S x2' },
  { t: T.fortune, s: S.phys1, cls: [C.OL4S], n: 2, days: A5, l: 'Phys OL4S x2' },
  { t: T.fortune, s: S.cs, cls: [C.OL3], n: 1, days: A5, l: 'CS OL3 x1' },
  { t: T.fortune, s: S.cs, cls: [C.ALSC, C.ALAR], n: 3, days: A5, l: 'CS AL x3' },
  { t: T.fortune, s: S.cs, cls: [C.OL5S], n: 2, days: A5, l: 'CS OL5S x2' },
  { t: T.fortune, s: S.cs, cls: [C.OL4S], n: 4, days: A5, l: 'CS OL4S x4' },
  { t: T.fortune, s: S.phys1, cls: [C.OL3], n: 1, days: A5, l: 'Phys OL3 x1' },
  { t: T.fortune, s: S.pmm, cls: [C.ALSC, C.ALAR], n: 3, days: A5, l: 'PMM AL x3' },
  // Nsoseh - Mon-Fri (30 slots, 20 lessons)
  { t: T.nsoseh, s: S.math, cls: [C.B1], n: 1, days: A5, l: 'Maths B1 x1' },
  { t: T.nsoseh, s: S.bizmath, cls: [C.OL3], n: 3, days: A5, l: 'BizMaths OL3 x3' },
  { t: T.nsoseh, s: S.digmkt, cls: [C.OL4A, C.OL4C, C.OL4S], n: 2, days: A5, l: 'DigMkt OL4 x2' },
  { t: T.nsoseh, s: S.digmkt, cls: [C.OL5A, C.OL5C, C.OL5S], n: 2, days: A5, l: 'DigMkt OL5 x2' },
  { t: T.nsoseh, s: S.bizmath, cls: [C.OL5A, C.OL5C, C.OL5S], n: 3, days: A5, l: 'BizMaths OL5 x3' },
  { t: T.nsoseh, s: S.bizmath, cls: [C.OL4A, C.OL4C, C.OL4S], n: 3, days: A5, l: 'BizMaths OL4 x3' },
  { t: T.nsoseh, s: S.cs, cls: [C.B1, C.B2], n: 2, days: A5, l: 'CS B1+B2 x2' },
  { t: T.nsoseh, s: S.acct, cls: [C.OL3], n: 1, days: A5, l: 'Acct OL3 x1' },
];
// Occupancy tracking
const tOcc = {};
const cOcc = {};
Object.values(T).forEach(tid => { tOcc[tid] = {}; D.forEach(d => { tOcc[tid][d] = {}; for (let p = 1; p <= 6; p++) tOcc[tid][d][p] = false; }); });
Object.values(C).forEach(cid => { cOcc[cid] = {}; D.forEach(d => { cOcc[cid][d] = {}; for (let p = 1; p <= 6; p++) cOcc[cid][d][p] = false; }); });

function canPlace(tid, day, p, cids) { if (tOcc[tid][day][p]) return false; for (const c of cids) if (cOcc[c][day][p]) return false; return true; }
function canPlaceDouble(tid, day, p, cids) { return p < 6 && canPlace(tid, day, p, cids) && canPlace(tid, day, p + 1, cids); }
function place(tid, day, p, cids) { tOcc[tid][day][p] = true; for (const c of cids) cOcc[c][day][p] = true; }

// Expand into individual lessons
const tLessons = {};
for (const req of reqs) {
  for (let i = 0; i < req.n; i++) {
    if (!tLessons[req.t]) tLessons[req.t] = [];
    tLessons[req.t].push({ s: req.s, cls: req.cls, days: req.days, dbl: req.dbl || false, l: req.l });
  }
}

// Sort: double first, fewest days first
Object.keys(tLessons).forEach(tid => {
  tLessons[tid].sort((a, b) => {
    if (a.dbl && !b.dbl) return -1;
    if (!a.dbl && b.dbl) return 1;
    return a.days.length - b.days.length;
  });
});

const entries = [];
let placed = 0, failed = 0;
// Phase 1: Place double periods (most constrained) - earliest consecutive slots
for (const tid of Object.keys(tLessons)) {
  for (let i = tLessons[tid].length - 1; i >= 0; i--) {
    const ls = tLessons[tid][i];
    if (!ls.dbl) continue;
    let ok = false;
    for (let p = 1; p <= 5; p++) {
      for (const day of ls.days) {
        if (canPlaceDouble(tid, day, p, ls.cls)) {
          place(tid, day, p, ls.cls);
          place(tid, day, p + 1, ls.cls);
          for (const cid of ls.cls) {
            entries.push({ teacherId: tid, teacherName: TN[tid], classId: cid, className: cN[cid] || CN[cid], subjectId: ls.s, subjectName: sN[ls.s] || 'Unknown', day, startTime: P[p-1][1], endTime: P[p-1][2], periodNumber: p, cycle: SC.has(cid) ? 'second' : 'first', ratePerPeriod: SC.has(cid) ? 700 : 500, academicYear: ACAD, isActive: true });
            entries.push({ teacherId: tid, teacherName: TN[tid], classId: cid, className: cN[cid] || CN[cid], subjectId: ls.s, subjectName: sN[ls.s] || 'Unknown', day, startTime: P[p][1], endTime: P[p][2], periodNumber: p+1, cycle: SC.has(cid) ? 'second' : 'first', ratePerPeriod: SC.has(cid) ? 700 : 500, academicYear: ACAD, isActive: true });
          }
          tLessons[tid].splice(i, 1);
          placed += 2;
          ok = true;
          break;
        }
      }
      if (ok) break;
    }
    if (!ok) { log('FAILED double: ' + TN[tid] + ' ' + ls.l); failed += 2; }
  }
}
// Phase 2: Period-major placement for single lessons
let remaining = true;
let iters = 0;
while (remaining && iters < 50) {
  remaining = false;
  iters++;
  for (let p = 1; p <= 6; p++) {
    for (const day of D) {
      for (const tid of Object.keys(tLessons)) {
        const lss = tLessons[tid];
        if (!lss.length) continue;
        remaining = true;
        for (let i = 0; i < lss.length; i++) {
          const ls = lss[i];
          if (ls.dbl) continue;
          if (!ls.days.includes(day)) continue;
          if (canPlace(tid, day, p, ls.cls)) {
            place(tid, day, p, ls.cls);
            for (const cid of ls.cls) {
              entries.push({ teacherId: tid, teacherName: TN[tid], classId: cid, className: cN[cid] || CN[cid], subjectId: ls.s, subjectName: sN[ls.s] || 'Unknown', day, startTime: P[p-1][1], endTime: P[p-1][2], periodNumber: p, cycle: SC.has(cid) ? 'second' : 'first', ratePerPeriod: SC.has(cid) ? 700 : 500, academicYear: ACAD, isActive: true });
            }
            lss.splice(i, 1);
            placed++;
            break;
          }
        }
      }
    }
  }
}

// Check remaining
for (const tid of Object.keys(tLessons)) {
  for (const ls of tLessons[tid]) {
    log('FAILED: ' + TN[tid] + ' ' + ls.l);
    failed++;
  }
}

log('Placed: ' + placed + ', Failed: ' + failed + ', Entries: ' + entries.length);
// Delete old and insert new
const delRes = await db.collection('timetables').deleteMany({ academicYear: ACAD });
log('Deleted ' + delRes.deletedCount + ' old entries');

if (entries.length > 0) {
  const { ObjectId } = mongoose.Types;
  const insData = entries.map(e => ({ ...e, teacherId: new ObjectId(e.teacherId), classId: new ObjectId(e.classId), subjectId: new ObjectId(e.subjectId) }));
  const insRes = await db.collection('timetables').insertMany(insData);
  log('Inserted ' + insRes.insertedCount + ' new entries');
}

// Verify no class double-bookings
const cB = {};
for (const e of entries) { const k = e.day + '|' + e.periodNumber + '|' + e.classId; if (!cB[k]) cB[k] = []; cB[k].push(e); }
let cC = 0;
for (const [k, bk] of Object.entries(cB)) { if (bk.length > 1) { cC++; log('CLASS CONFLICT: ' + k + ' = ' + bk.length); } }
log('Class conflicts: ' + cC);

// Verify no teacher conflicts
const tB = {};
for (const e of entries) { const k = e.day + '|' + e.periodNumber + '|' + e.teacherId; if (!tB[k]) tB[k] = []; tB[k].push(e); }
let tC = 0;
for (const [k, bk] of Object.entries(tB)) { const uS = new Set(bk.map(b => b.subjectId)); if (uS.size > 1) { tC++; log('TEACHER CONFLICT: ' + k); } }
log('Teacher conflicts: ' + tC);

// Verify teacher x double
const txLit = entries.filter(e => e.teacherId === T.teacherx && e.subjectId === S.lit2);
log('teacher x Lit ALAR: ' + txLit.length);
if (txLit.length === 2) log('  Double: sameDay=' + (txLit[0].day === txLit[1].day) + ', consecutive=' + (Math.abs(txLit[0].periodNumber - txLit[1].periodNumber) === 1));

// Verify Mercy days
const mDays = [...new Set(entries.filter(e => e.teacherId === T.mercy).map(e => e.day))];
log('Mercy days: ' + mDays.join(', '));

await mongoose.disconnect();
log('Done!');
