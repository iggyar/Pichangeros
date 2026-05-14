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

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" />;
  }

  const isAdminEmail = user?.email === "iggy666thepro@gmail.com" || user?.email === "ignaciotaipe0@gmail.com";

  if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdminEmail) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  
  useEffect(() => {
    if (loading) return;
    
    const initDummyField = async () => {
      try {
        const isAdminEmail = user?.email === "iggy666thepro@gmail.com" || user?.email === "ignaciotaipe0@gmail.com";
        const isAdmin = profile?.role === "admin" || isAdminEmail;
        
        // Only attempt creation if user is an admin
        if (!isAdmin) return;

        const fieldRef = doc(db, "fields", "cancha-prueba");
        const fieldSnap = await getDoc(fieldRef);
        
        if (!fieldSnap.exists()) {
          console.log("Creating dummy field...");
          await setDoc(fieldRef, {
            name: "Cancha de Prueba",
            location: {
              address: "Av. La Molina 123, La Molina, Lima",
              district: "La Molina",
              lat: -12.085,
              lng: -76.945
            },
            district: "La Molina",
            price: 50,
            pricePerHour: 50,
            status: "approved",
            ownerId: user?.uid || "CAfFPB0IyeaaOs50RNFUmTY8T2a2",
            description: "Cancha de prueba para testear el flujo",
            sport: "football",
            capacity: 10,
            surfaceType: "Sintético",
            photos: ["https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1200"],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log("Dummy field created!");
        }
      } catch (error) {
        console.error("Error creating dummy field:", error);
      }
    };
    
    initDummyField();
  }, [user, profile, loading]);

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

