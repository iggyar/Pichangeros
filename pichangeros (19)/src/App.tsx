/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./lib/firebase";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Search from "./pages/Search";
import FieldDetails from "./pages/FieldDetails";
import UserDashboard from "./pages/UserDashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

const ADMIN_EMAILS = ["iggy666thepro@gmail.com", "ignaciotaipe0@gmail.com"];

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" />;
  }

  const isAdmin = profile?.role === "admin" || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const effectiveRole = isAdmin ? "admin" : profile.role;

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  
  useEffect(() => {
    if (loading) return;

    const isAdmin = profile?.role === "admin" || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
    if (!isAdmin) {
      console.log("Skipping dummy data cleanup for non-admin user.");
      return;
    }

    const cleanupDummyData = async () => {
      try {
        console.log("Starting dummy data cleanup...");
        
        const { getDocs, query, collection, where, deleteDoc, doc } = await import("firebase/firestore");
        const fieldsColRef = collection(db, "fields");
        
        // Find fields named 'Canchas El Golazo'
        const q1 = query(fieldsColRef, where("name", "==", "Canchas El Golazo"));
        const snap1 = await getDocs(q1);
        
        // Find fields named 'Cancha de Prueba'
        const q2 = query(fieldsColRef, where("name", "==", "Cancha de Prueba"));
        const snap2 = await getDocs(q2);
        
        const fieldIdsToDelete = new Set<string>();
        fieldIdsToDelete.add("cancha-prueba");
        
        snap1.docs.forEach((d) => fieldIdsToDelete.add(d.id));
        snap2.docs.forEach((d) => fieldIdsToDelete.add(d.id));
        
        // Let's delete each field document and its associated bookings
        for (const fieldId of fieldIdsToDelete) {
          console.log(`Deleting field: ${fieldId}`);
          await deleteDoc(doc(db, "fields", fieldId));
          
          const BookingsColRef = collection(db, "bookings");
          const qBookings = query(BookingsColRef, where("fieldId", "==", fieldId));
          const bookingsSnap = await getDocs(qBookings);
          
          for (const bookingDoc of bookingsSnap.docs) {
            console.log(`Deleting booking: ${bookingDoc.id} associated with field: ${fieldId}`);
            await deleteDoc(doc(db, "bookings", bookingDoc.id));
          }
        }
        
        console.log("Cleanup of dummy fields and bookings complete!");
      } catch (error) {
        console.warn("Note during dummy data cleanup:", error);
      }
    };
    
    cleanupDummyData();
  }, [loading, user, profile]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/search" element={<Search />} />
        <Route path="/field/:id" element={<FieldDetails />} />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={["user", "owner", "admin"]}>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/owner" 
          element={
            <ProtectedRoute allowedRoles={["user", "owner", "admin"]}>
              <OwnerDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}

