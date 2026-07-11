// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { Toaster } from "@/components/ui/sonner";
// import { Landing } from "@/pages/Landing";
// import { LoginPage } from "@/pages/Login";
// import { AppLayout } from "@/pages/AppLayout";
// import { Dashboard } from "@/pages/Dashboard";
// import { StudentsPage } from "@/pages/Students";
// import { TeachersPage } from "@/pages/Teachers";
// import { ClassesPage } from "@/pages/Classes";
// import { MarkEntry } from "@/pages/MarkEntry";
// import { ReportCardsIndex } from "@/pages/ReportCards";
// import { ReportCard } from "@/pages/ReportCard";
// import { ReportCardsBulk } from "@/pages/ReportCardsBulk";
// import { FeesPage } from "@/pages/Fees";
// import { SettingsPage } from "@/pages/Settings";
// import { PromotionPage } from "@/pages/Promotion";

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Landing />} />
//         <Route path="/login" element={<LoginPage />} />
//         <Route path="/app" element={<AppLayout />}>
//           <Route index element={<Dashboard />} />
//           <Route path="students" element={<StudentsPage />} />
//           <Route path="teachers" element={<TeachersPage />} />
//           <Route path="classes" element={<ClassesPage />} />
//           <Route path="mark-entry" element={<MarkEntry />} />
//           <Route path="report-cards" element={<ReportCardsIndex />} />
//           <Route path="report-cards/bulk" element={<ReportCardsBulk />} />
//           <Route path="report-cards/:studentId" element={<ReportCard />} />
//           <Route path="fees" element={<FeesPage />} />
//           <Route path="promotion" element={<PromotionPage />} />
//           <Route path="settings" element={<SettingsPage />} />
//         </Route>
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//       <Toaster richColors position="top-right" />
//     </BrowserRouter>
//   );
// }





























import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Landing } from "@/pages/Landing";
import { LoginPage } from "@/pages/Login";
import { AppLayout } from "@/pages/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { StudentsPage } from "@/pages/Students";
import { TeachersPage } from "@/pages/Teachers";
import { ClassesPage } from "@/pages/Classes";
import { MarkEntry } from "@/pages/MarkEntry";
import { ReportCardsIndex } from "@/pages/ReportCards";
import { ReportCard } from "@/pages/ReportCard";
import { ReportCardsBulk } from "@/pages/ReportCardsBulk";
import { FeesPage } from "@/pages/Fees";
import { SettingsPage } from "@/pages/Settings";
import { PromotionPage } from "@/pages/Promotion";
import {TimetableAdminPage} from "@/pages/Timestable";
import {TeacherTimetableView} from "@/pages/Teacherstimetable";
import {TeacherAttendancePage} from "@/pages/Salary";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="timetable" element={<TimetableAdminPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="teacher-timetable" element={<TeacherTimetableView />} />
          <Route path="teacher-attendance" element={<TeacherAttendancePage />} />
          <Route path="mark-entry" element={<MarkEntry />} />
          <Route path="report-cards" element={<ReportCardsIndex />} />
          <Route path="report-cards/bulk" element={<ReportCardsBulk />} />
          <Route path="report-cards/:studentId" element={<ReportCard />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="promotion" element={<PromotionPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}