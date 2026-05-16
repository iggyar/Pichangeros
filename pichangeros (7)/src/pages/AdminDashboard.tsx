import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogOut, Trophy, Users, MapPin, CalendarDays, DollarSign, ShieldAlert, Settings, CheckCircle2, XCircle, Eye, Shield, Activity, AlertCircle, Search as SearchIcon, Filter } from "lucide-react";
import { collection, query, getDocs, updateDoc, doc, getDoc, onSnapshot, orderBy, where, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mock Data for Admin Panel removed
export default function AdminDashboard() {
  const { user, profile, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard");

  const [users, setUsers] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [manualPayments, setManualPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>({
    commission: 10,
    maintenanceMode: false,
    cancelationPolicy: "24h - 80% reembolso"
  });

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || !isAdmin) {
      if (profile && profile.role !== "admin") {
        navigate("/dashboard");
      }
      return;
    }
    
    setLoading(false);
  }, [user, isAdmin, profile, authLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "settings/global");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const reportsData = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let targetContent = "Contenido no disponible";
        
        if (data.type === "review" && data.targetId) {
          try {
            const reviewDoc = await getDoc(doc(db, "reviews", data.targetId));
            if (reviewDoc.exists()) {
              targetContent = reviewDoc.data().comment || "Sin comentario (solo calificación)";
            }
          } catch (e) {
            console.error("Error fetching review for report:", e);
          }
        }
        
        reportsData.push({ id: docSnapshot.id, targetContent, ...data });
      }
      setReports(reportsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "reports");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "bookings"), where("paymentMethod", "==", "yape"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setManualPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bookings");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });
    return () => unsubscribeUsers();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const bookingsData = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let playerName = data.userName || "Jugador desconocido";
        let courtName = data.fieldName || "Cancha desconocida";
        let amount = data.price || data.montoTotal || 0;

        // Fallback for ghost bookings
        if (!data.playerName && data.userId) {
          try {
            const userSub = await getDoc(doc(db, "users", data.userId));
            if (userSub.exists()) playerName = userSub.data().displayName || playerName;
          } catch (e) {}
        }
        if (!data.fieldName && data.fieldId) {
          try {
            const fieldSub = await getDoc(doc(db, "fields", data.fieldId));
            if (fieldSub.exists()) courtName = fieldSub.data().name || courtName;
          } catch (e) {}
        }

        bookingsData.push({
          id: docSnapshot.id,
          player: playerName,
          court: courtName,
          amount: amount,
          date: data.date ? format(new Date(data.date + 'T00:00:00'), "dd/MM/yy") : "N/A",
          time: data.timeSlot || "N/A",
          ...data
        });
      }
      setReservations(bookingsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bookings");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "bookings"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPayments = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (data.paymentStatus !== "paid" && data.paymentStatus !== "released" && data.estadoPago !== "Pago confirmado") return null;
          return {
            id: doc.id,
            player: data.userName || "Desconocido",
            court: data.fieldName || "Desconocido",
            total: data.montoTotal || data.price || 0,
            date: data.date || (data.createdAt ? format(new Date(data.createdAt.seconds * 1000), "dd/MM/yy") : "N/A"),
            reservationId: doc.id,
            ...data
          } as any;
        })
        .filter(Boolean);
      
      // Sort in memory
      fetchedPayments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return timeB - timeA;
      });
      setPayments(fetchedPayments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bookings");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDisputes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "support_tickets");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "fields"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const courtsData = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        let ownerName = "Desconocido";
        if (data.ownerId) {
          try {
            const userDoc = await getDoc(doc(db, "users", data.ownerId));
            if (userDoc.exists()) {
              ownerName = userDoc.data().displayName || "Desconocido";
            }
          } catch (e) {}
        }
        
        courtsData.push({
          id: docSnapshot.id,
          name: data.name,
          owner: ownerName,
          district: data.location?.district || data.district || "No especificado",
          type: data.surfaceType || "No especificado",
          status: data.status,
          registeredAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "Reciente",
          ...data
        });
      }
      setCourts(courtsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "fields");
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedCourt, setSelectedCourt] = useState<any>(null);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);

  const [userSearch, setUserSearch] = useState("");
  const [courtSearch, setCourtSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [disputeSearch, setDisputeSearch] = useState("");
  const [courtFilter, setCourtFilter] = useState("all");
  
  const [rejectingCourtId, setRejectingCourtId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingCourts = courts.filter(c => c.status === "pending");

  const filteredUsers = users.filter(u => (u.displayName || "").toLowerCase().includes(userSearch.toLowerCase()) || (u.email || "").toLowerCase().includes(userSearch.toLowerCase()));
  const filteredCourts = courts.filter(c => {
    const matchesSearch = (c.name || "").toLowerCase().includes(courtSearch.toLowerCase()) || 
                         (c.owner || "").toLowerCase().includes(courtSearch.toLowerCase());
    const matchesFilter = courtFilter === "all" || c.status === courtFilter;
    return matchesSearch && matchesFilter;
  });
  const filteredReservations = reservations.filter(r => (r.userName || "").toLowerCase().includes(reservationSearch.toLowerCase()) || (r.fieldName || "").toLowerCase().includes(reservationSearch.toLowerCase()) || r.id.toLowerCase().includes(reservationSearch.toLowerCase()));
  const filteredPayments = payments.filter(p => (p.userName || "").toLowerCase().includes(paymentSearch.toLowerCase()) || p.id.toLowerCase().includes(paymentSearch.toLowerCase()) || (p.fieldName || "").toLowerCase().includes(paymentSearch.toLowerCase()));
  const filteredDisputes = disputes.filter(d => (d.userName?.toLowerCase() || "").includes(disputeSearch.toLowerCase()) || d.id.toLowerCase().includes(disputeSearch.toLowerCase()));

  const handleApproveCourt = async (id: string) => {
    try {
      await updateDoc(doc(db, "fields", id), { status: "approved" });
      toast.success("Local aprobado exitosamente");
    } catch (error) {
      toast.error("Error al aprobar local");
    }
  };

  const handleRejectCourt = (id: string) => {
    setRejectingCourtId(id);
  };

  const confirmRejectCourt = async () => {
    if (!rejectingCourtId) return;
    if (!rejectReason.trim()) {
      toast.error("Debes ingresar una razón para el rechazo");
      return;
    }
    try {
      await updateDoc(doc(db, "fields", rejectingCourtId), { 
        status: "rejected", 
        rejectReason 
      });
      toast.success("Local rechazado");
      setRejectingCourtId(null);
      setRejectReason("");
    } catch (error) {
      toast.error("Error al rechazar local");
    }
  };

  const handleSuspendUser = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, "users", id), {
        status: currentStatus === "active" ? "suspended" : "active"
      });
      toast.success("Estado de usuario actualizado");
    } catch (error) {
      toast.error("Error al actualizar usuario");
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", id), {
        role: newRole
      });
      toast.success("Rol de usuario actualizado");
    } catch (error) {
      toast.error("Error al actualizar rol");
    }
  };

  const handleConfirmManualPayment = async (bookingId: string) => {
    try {
      const checkInCode = Math.floor(100000 + Math.random() * 900000).toString();
      await updateDoc(doc(db, "bookings", bookingId), {
        estadoPago: "Pago confirmado",
        paymentStatus: "paid",
        status: "active",
        checkInCode,
        updatedAt: serverTimestamp()
      });
      toast.success("Pago confirmado correctamente. Código de acceso generado.");
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Error al confirmar el pago");
    }
  };

  const handleRejectManualPayment = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        estadoPago: "Rechazado",
        paymentStatus: "failed", // or cancelled
        updatedAt: serverTimestamp()
      });
      toast.success("Pago rechazado");
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error("Error al rechazar el pago");
    }
  };

  const handleMarkOwnerPaid = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        pagoAlDueno: true,
        updatedAt: serverTimestamp()
      });
      toast.success("Pago a dueño marcado como completado");
    } catch (error) {
      console.error("Error marking owner as paid:", error);
      toast.error("Error al marcar pago a dueño");
    }
  };

  const handleResolveDispute = async (id: string) => {
    try {
      await updateDoc(doc(db, "support_tickets", id), {
        status: "resolved",
        resolvedAt: new Date()
      });
      toast.success("Ticket resuelto");
      setSelectedDispute(null);
    } catch (error) {
      console.error("Error resolving ticket:", error);
      toast.error("Error al resolver el ticket");
    }
  };

  const handleResolveReport = async (reportId: string, action: 'keep' | 'delete') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      if (action === 'delete') {
        if (report.type === 'review') {
          await updateDoc(doc(db, "reviews", report.targetId), {
            deleted: true
          });
        }
      }

      await updateDoc(doc(db, "reports", reportId), {
        status: "resolved",
        actionTaken: action,
        resolvedAt: serverTimestamp()
      });
      
      toast.success(`Reporte resuelto (${action === 'keep' ? 'Contenido mantenido' : 'Contenido eliminado'})`);
    } catch (error) {
      console.error("Error resolving report:", error);
      toast.error("Error al resolver el reporte");
    }
  };

  const handleUpdateSystemSetting = async (key: string, value: any) => {
    try {
      await setDoc(doc(db, "settings", "global"), {
        [key]: value,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success("Configuración actualizada");
    } catch (error) {
      console.error("Error updating system setting:", error);
      toast.error("Error al actualizar la configuración");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold tracking-tight">Pichangeros <span className="text-green-400 text-sm font-normal">Admin</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-sm font-bold text-green-400">
                {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "A"}
              </div>
              <span className="text-sm font-medium text-slate-300 hidden sm:block">
                {profile?.displayName || "Administrador"}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => logout()} className="text-slate-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
            <div className="p-4 space-y-1">
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("dashboard")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "dashboard" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Activity className="w-5 h-5 mr-3" />
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("users")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "users" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Users className="w-5 h-5 mr-3" />
                Usuarios
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("courts")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "courts" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <MapPin className="w-5 h-5 mr-3" />
                Canchas
                {pendingCourts.length > 0 && (
                  <Badge className="ml-auto bg-amber-500 text-white border-none">{pendingCourts.length}</Badge>
                )}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("reservations")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "reservations" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <CalendarDays className="w-5 h-5 mr-3" />
                Reservas
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("payments")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "payments" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <DollarSign className="w-5 h-5 mr-3" />
                Pagos
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("disputes")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "disputes" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <ShieldAlert className="w-5 h-5 mr-3" />
                Soporte / Disputas
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("settings")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "settings" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Configuración
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView("reports")}
                className={`w-full justify-start rounded-xl h-12 ${activeView === "reports" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <AlertCircle className="w-5 h-5 mr-3" />
                Reportes
                {reports.filter(r => r.status === 'pending').length > 0 && (
                  <Badge className="ml-auto bg-red-500 text-white border-none">{reports.filter(r => r.status === 'pending').length}</Badge>
                )}
              </Button>
              <div className="my-4 border-t border-slate-100"></div>
              <Button 
                variant="outline" 
                onClick={() => navigate("/dashboard")}
                className="w-full justify-start rounded-xl h-12 border-green-200 text-green-700 hover:bg-green-50"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver como usuario
              </Button>
            </div>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {activeView === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Vista General</h2>
              
              {/* Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Total Usuarios</p>
                    <h3 className="text-2xl font-bold text-slate-900">{users.length}</h3>
                    <p className="text-xs text-slate-500 mt-2 flex items-center">
                      <Activity className="w-3 h-3 mr-1" /> Usuarios registrados
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Canchas Activas</p>
                    <h3 className="text-2xl font-bold text-slate-900">{courts.filter(c => c.status === 'approved').length}</h3>
                    <p className="text-xs text-amber-600 mt-2 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" /> {pendingCourts.length} pendientes
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Reservas Totales</p>
                    <h3 className="text-2xl font-bold text-slate-900">{reservations.length}</h3>
                    <p className="text-xs text-slate-500 mt-2 flex items-center">
                      <Activity className="w-3 h-3 mr-1" /> {reservations.filter(r => r.status === 'active').length} activas
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-amber-600">Comisión Total</p>
                    <h3 className="text-2xl font-bold text-slate-900">S/ {(payments.reduce((acc, p) => acc + (p.total || 0), 0) * (systemSettings.commission / 100)).toFixed(2)}</h3>
                    <p className="text-xs text-green-600 mt-2 flex items-center">
                      <Activity className="w-3 h-3 mr-1" /> De {payments.length} pagos
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-amber-500">Pagos a Verificar</p>
                    <h3 className="text-2xl font-bold text-slate-900">{manualPayments.filter(p => p.estadoPago === "Pago enviado - verificar").length}</h3>
                    <p className="text-xs text-amber-600 mt-2 flex items-center">
                      <Activity className="w-3 h-3 mr-1" /> Manuales Yape/Plin
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Courts */}
              {pendingCourts.length > 0 && (
                <Card className="border-amber-200 shadow-sm rounded-2xl overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-amber-900">Canchas pendientes de aprobación ({pendingCourts.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 font-bold">Cancha</th>
                          <th className="px-6 py-3 font-bold">Dueño</th>
                          <th className="px-6 py-3 font-bold">Distrito</th>
                          <th className="px-6 py-3 font-bold">Fecha</th>
                          <th className="px-6 py-3 font-bold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingCourts.map((court) => (
                          <tr key={court.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-900">{court.name}</td>
                            <td className="px-6 py-3 text-slate-600">{court.owner}</td>
                            <td className="px-6 py-3 text-slate-600">{court.district}</td>
                            <td className="px-6 py-3 text-slate-600">{court.registeredAt}</td>
                            <td className="px-6 py-3 text-right space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => setSelectedCourt(court)}>
                                    <Eye className="w-4 h-4 mr-1" /> Ver
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Detalle de Cancha</DialogTitle>
                                  </DialogHeader>
                                  {selectedCourt && (
                                    <div className="space-y-4">
                                      <div><span className="font-bold">Nombre:</span> {selectedCourt.name}</div>
                                      <div><span className="font-bold">Dueño:</span> {selectedCourt.owner}</div>
                                      <div><span className="font-bold">Distrito:</span> {selectedCourt.district}</div>
                                      <div><span className="font-bold">Tipo:</span> {selectedCourt.type}</div>
                                      <div><span className="font-bold">Estado:</span> {selectedCourt.status}</div>
                                      <div><span className="font-bold">Registro:</span> {selectedCourt.registeredAt}</div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApproveCourt(court.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                              </Button>
                              <Dialog open={rejectingCourtId === court.id} onOpenChange={(open) => {
                                if (!open) {
                                  setRejectingCourtId(null);
                                  setRejectReason("");
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectingCourtId(court.id)}>
                                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Rechazar Cancha</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Razón del rechazo</label>
                                      <Input 
                                        placeholder="Ej: Documentación incompleta, ubicación no válida..." 
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                      />
                                    </div>
                                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleRejectCourt}>
                                      Confirmar Rechazo
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Recent Reservations */}
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900">Últimas Reservas</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-bold">ID</th>
                        <th className="px-6 py-3 font-bold">Jugador</th>
                        <th className="px-6 py-3 font-bold">Cancha</th>
                        <th className="px-6 py-3 font-bold">Fecha/Hora</th>
                        <th className="px-6 py-3 font-bold">Monto</th>
                        <th className="px-6 py-3 font-bold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reservations.slice(0, 5).map((res) => (
                        <tr key={res.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-mono text-xs text-slate-500">{res.id}</td>
                          <td className="px-6 py-3 font-medium text-slate-900">{res.player}</td>
                          <td className="px-6 py-3 text-slate-600">{res.court}</td>
                          <td className="px-6 py-3 text-slate-600">{res.date} {res.time}</td>
                          <td className="px-6 py-3 font-bold text-slate-900">S/ {res.amount}</td>
                          <td className="px-6 py-3 text-right">
                            <Badge variant="outline" className={`
                              ${res.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                              ${res.status === 'active' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}
                              ${res.status === 'cancelled' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                            `}>
                              {res.status === 'completed' ? 'Completada' : res.status === 'active' ? 'Activa' : 'Cancelada'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "users" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="search"
                      placeholder="Buscar usuario..."
                      className="pl-8"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Nombre</th>
                        <th className="px-6 py-4 font-bold">Email</th>
                        <th className="px-6 py-4 font-bold">Celular</th>
                        <th className="px-6 py-4 font-bold">Rol</th>
                        <th className="px-6 py-4 font-bold">Registro</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{u.displayName || "Sin nombre"}</td>
                          <td className="px-6 py-4 text-slate-600">{u.email}</td>
                          <td className="px-6 py-4 text-slate-600">{u.phoneNumber || "N/A"}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={u.role === 'owner' ? 'bg-blue-50 text-blue-700 border-blue-200' : u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>
                              {u.role === 'owner' ? 'Dueño' : u.role === 'admin' ? 'Admin' : 'Jugador'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                              {u.status === 'active' ? 'Activo' : 'Suspendido'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setSelectedUser(u)}>
                                  <Shield className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Gestionar Rol de Usuario</DialogTitle>
                                </DialogHeader>
                                {selectedUser && (
                                  <div className="space-y-4 py-4">
                                    <div className="flex flex-col gap-2">
                                      <p className="text-sm font-bold">Cambiar rol para: {selectedUser.displayName || selectedUser.email}</p>
                                      <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                          variant={selectedUser.role === 'user' ? 'default' : 'outline'} 
                                          onClick={() => handleUpdateRole(selectedUser.id, 'user')}
                                        >
                                          Jugador
                                        </Button>
                                        <Button 
                                          variant={selectedUser.role === 'owner' ? 'default' : 'outline'} 
                                          onClick={() => handleUpdateRole(selectedUser.id, 'owner')}
                                        >
                                          Dueño
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button size="icon" variant="ghost" className={`h-8 w-8 ${u.status === 'active' ? 'text-slate-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}`} onClick={() => handleSuspendUser(u.id, u.status || 'active')}>
                              {u.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "courts" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Canchas</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="search"
                      placeholder="Buscar cancha o dueño..."
                      className="pl-8"
                      value={courtSearch}
                      onChange={(e) => setCourtSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <Tabs defaultValue="all" className="w-full" onValueChange={setCourtFilter}>
                    <TabsList>
                      <TabsTrigger value="all">Todas</TabsTrigger>
                      <TabsTrigger value="pending">Pendientes</TabsTrigger>
                      <TabsTrigger value="approved">Aprobadas</TabsTrigger>
                      <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Nombre</th>
                        <th className="px-6 py-4 font-bold">Dueño</th>
                        <th className="px-6 py-4 font-bold">Distrito</th>
                        <th className="px-6 py-4 font-bold">Tipo</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCourts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                          <td className="px-6 py-4 text-slate-600">{c.owner}</td>
                          <td className="px-6 py-4 text-slate-600">{c.district}</td>
                          <td className="px-6 py-4 text-slate-600">{c.type}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`
                              ${c.status === 'approved' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                              ${c.status === 'pending' ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                              ${c.status === 'rejected' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                            `}>
                              {c.status === 'approved' ? 'Aprobada' : c.status === 'pending' ? 'Pendiente' : 'Rechazada'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setSelectedCourt(c)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Detalle de Cancha</DialogTitle>
                                </DialogHeader>
                                {selectedCourt && (
                                  <div className="space-y-4">
                                    <div><span className="font-bold">Nombre:</span> {selectedCourt.name}</div>
                                    <div><span className="font-bold">Dueño:</span> {selectedCourt.owner}</div>
                                    <div><span className="font-bold">Distrito:</span> {selectedCourt.district}</div>
                                    <div><span className="font-bold">Tipo:</span> {selectedCourt.type}</div>
                                    <div><span className="font-bold">Estado:</span> {selectedCourt.status}</div>
                                    <div><span className="font-bold">Registro:</span> {selectedCourt.registeredAt}</div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            {c.status === 'pending' && (
                              <>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApproveCourt(c.id)}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRejectCourt(c.id)}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              
              <Dialog open={!!rejectingCourtId} onOpenChange={(open) => !open && setRejectingCourtId(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rechazar Cancha</DialogTitle>
                    <DialogDescription>
                      Ingresa el motivo por el cual estás rechazando esta cancha. Este mensaje será enviado al dueño.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input 
                      placeholder="Motivo del rechazo..." 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setRejectingCourtId(null)}>Cancelar</Button>
                    <Button variant="destructive" onClick={confirmRejectCourt}>Rechazar Cancha</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {activeView === "reservations" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Todas las Reservas</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="search"
                      placeholder="Buscar reserva..."
                      className="pl-8"
                      value={reservationSearch}
                      onChange={(e) => setReservationSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">ID</th>
                        <th className="px-6 py-4 font-bold">Jugador</th>
                        <th className="px-6 py-4 font-bold">Cancha</th>
                        <th className="px-6 py-4 font-bold">Fecha/Hora</th>
                        <th className="px-6 py-4 font-bold">Monto</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReservations.map((res) => (
                        <tr key={res.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{res.id}</td>
                          <td className="px-6 py-4 font-medium text-slate-900">{res.player}</td>
                          <td className="px-6 py-4 text-slate-600">{res.court}</td>
                          <td className="px-6 py-4 text-slate-600">{res.date} {res.time}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">S/ {res.amount}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`
                              ${res.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                              ${res.status === 'active' ? 'border-blue-200 text-blue-700 bg-blue-50' : ''}
                              ${res.status === 'cancelled' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                            `}>
                              {res.status === 'completed' ? 'Completada' : res.status === 'active' ? 'Activa' : 'Cancelada'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => setSelectedReservation(res)}>
                                  Ver Detalle
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Detalle de Reserva</DialogTitle>
                                </DialogHeader>
                                {selectedReservation && (
                                  <div className="space-y-4">
                                    <div><span className="font-bold">ID:</span> {selectedReservation.id}</div>
                                    <div><span className="font-bold">Jugador:</span> {selectedReservation.player}</div>
                                    <div><span className="font-bold">Cancha:</span> {selectedReservation.court}</div>
                                    <div><span className="font-bold">Fecha/Hora:</span> {selectedReservation.date} {selectedReservation.time}</div>
                                    <div><span className="font-bold">Monto:</span> S/ {selectedReservation.amount}</div>
                                    <div><span className="font-bold">Estado:</span> {selectedReservation.status}</div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "payments" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Pagos</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="search"
                      placeholder="Buscar pago..."
                      className="pl-8"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-blue-800 mb-1">Total Procesado (Histórico)</p>
                    <h3 className="text-3xl font-bold text-blue-900">S/ {payments.reduce((acc, p) => acc + (p.total || 0), 0).toFixed(2)}</h3>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-green-800 mb-1">Comisión Plataforma ({systemSettings.commission}%)</p>
                    <h3 className="text-3xl font-bold text-green-900">S/ {(payments.reduce((acc, p) => acc + (p.total || 0), 0) * (systemSettings.commission / 100)).toFixed(2)}</h3>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-amber-800 mb-1">Pagos pendientes de verificar</p>
                    <h3 className="text-3xl font-bold text-amber-900">{manualPayments.filter(p => p.estadoPago === "Pago enviado - verificar").length}</h3>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Gestión de Pagos Manuales (Yape/Plin)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Fecha/Hora</th>
                        <th className="px-6 py-4 font-bold">ID Reserva</th>
                        <th className="px-6 py-4 font-bold">Jugador</th>
                        <th className="px-6 py-4 font-bold">Cancha</th>
                        <th className="px-6 py-4 font-bold">Monto</th>
                        <th className="px-6 py-4 font-bold">Cód. Op. Yape</th>
                        <th className="px-6 py-4 font-bold">Estado Pago</th>
                        <th className="px-6 py-4 font-bold">Pago a Dueño</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manualPayments.map((p) => {
                        const ownerPayout = (p.price || p.montoTotal || 0) * 0.9;
                        const formattedDate = p.date ? format(new Date(p.date + 'T00:00:00'), "dd/MM/yy") : "N/A";
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-600">{formattedDate} {p.timeSlot}</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.id.slice(0, 8)}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{p.userName}</td>
                            <td className="px-6 py-4 text-slate-600">{p.fieldName}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">S/ {(p.price || p.montoTotal || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">{p.codigoOperacionYape || "N/A"}</td>
                            <td className="px-6 py-4">
                              <Badge variant="outline" className={`
                                ${p.estadoPago === 'Pago confirmado' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                                ${p.estadoPago === 'pendiente_verificacion' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' : ''}
                                ${p.estadoPago === 'Rechazado' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                                ${!p.estadoPago || p.estadoPago === 'Pendiente de pago' ? 'border-slate-200 text-slate-700 bg-slate-50' : ''}
                              `}>
                                {p.estadoPago === 'pendiente_verificacion' ? 'Por Verificar' : (p.estadoPago || "Pendiente")}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-green-600">S/ {ownerPayout.toFixed(2)}</span>
                                <Badge variant="outline" className={`mt-1 h-5 text-[10px] w-fit ${p.pagoAlDueno ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                  {p.pagoAlDueno ? "Pagado" : "Pendiente"}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              {p.estadoPago === "pendiente_verificacion" && (
                                <>
                                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-8" onClick={() => handleConfirmManualPayment(p.id)}>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8" onClick={() => handleRejectManualPayment(p.id)}>
                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
                                  </Button>
                                </>
                              )}
                              {p.estadoPago === "Pago confirmado" && !p.pagoAlDueno && (
                                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8" onClick={() => handleMarkOwnerPaid(p.id)}>
                                  Mark Pago Dueño
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {manualPayments.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center text-slate-500 italic">No hay pagos manuales registrados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-8">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Historial de Pagos Procesados</h3>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Fecha</th>
                        <th className="px-6 py-4 font-bold">ID Reserva</th>
                        <th className="px-6 py-4 font-bold">Jugador</th>
                        <th className="px-6 py-4 font-bold">Cancha</th>
                        <th className="px-6 py-4 font-bold">Monto Total</th>
                        <th className="px-6 py-4 font-bold text-blue-600">Comisión ({systemSettings.commission}%)</th>
                        <th className="px-6 py-4 font-bold text-green-600">Pago Dueño ({100 - systemSettings.commission}%)</th>
                        <th className="px-6 py-4 font-bold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayments.map((p) => {
                        const commission = p.total * (systemSettings.commission / 100);
                        const ownerPayout = p.total * ((100 - systemSettings.commission) / 100);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-slate-600">{p.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.reservationId}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{p.player}</td>
                            <td className="px-6 py-4 text-slate-600">{p.court}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">S/ {p.total.toFixed(2)}</td>
                            <td className="px-6 py-4 font-bold text-blue-600">S/ {commission.toFixed(2)}</td>
                            <td className="px-6 py-4 font-bold text-green-600">S/ {ownerPayout.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right">
                              <Badge variant="outline" className={`
                                ${p.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                                ${p.status === 'processing' ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                                ${p.status === 'refunded' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                              `}>
                                {p.status === 'completed' ? 'Completado' : p.status === 'processing' ? 'Procesando' : 'Reembolsado'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "disputes" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Soporte y Disputas</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      type="search"
                      placeholder="Buscar ticket..."
                      className="pl-8"
                      value={disputeSearch}
                      onChange={(e) => setDisputeSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">ID</th>
                        <th className="px-6 py-4 font-bold">Usuario</th>
                        <th className="px-6 py-4 font-bold">Rol</th>
                        <th className="px-6 py-4 font-bold">Tema</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDisputes.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4 font-medium text-slate-900">{d.userName}</td>
                          <td className="px-6 py-4 text-slate-600 capitalize">{d.userRole}</td>
                          <td className="px-6 py-4 text-slate-600">{d.topic}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`
                              ${d.status === 'open' ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                              ${d.status === 'resolved' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                            `}>
                              {d.status === 'open' ? 'Abierta' : 'Resuelta'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50" onClick={() => setSelectedDispute(d)}>
                                  Ver
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Detalle de Ticket</DialogTitle>
                                </DialogHeader>
                                {selectedDispute && (
                                  <div className="space-y-4">
                                    <div><span className="font-bold">ID:</span> {selectedDispute.id}</div>
                                    <div><span className="font-bold">Usuario:</span> {selectedDispute.userName}</div>
                                    <div><span className="font-bold">Email:</span> {selectedDispute.userEmail}</div>
                                    <div><span className="font-bold">Rol:</span> <span className="capitalize">{selectedDispute.userRole}</span></div>
                                    <div><span className="font-bold">Tema:</span> {selectedDispute.topic}</div>
                                    <div><span className="font-bold">Mensaje:</span> <div className="p-3 bg-slate-50 rounded-xl mt-1 text-sm">{selectedDispute.message}</div></div>
                                    <div><span className="font-bold">Estado:</span> {selectedDispute.status === 'open' ? 'Abierta' : 'Resuelta'}</div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            {d.status === 'open' && (
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleResolveDispute(d.id)}>
                                Resolver
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "reports" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Moderación de Contenido</h2>
              </div>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Tipo</th>
                        <th className="px-6 py-4 font-bold">Reportado por</th>
                        <th className="px-6 py-4 font-bold">Contenido</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reports.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="bg-slate-100 text-slate-700">
                              {r.type === 'review' ? 'Reseña' : r.type}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{r.reporterName}</td>
                          <td className="px-6 py-4 max-w-xs truncate text-slate-600">{r.targetContent}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`
                              ${r.status === 'pending' ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                              ${r.status === 'resolved' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                            `}>
                              {r.status === 'pending' ? 'Pendiente' : 'Revisado'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {r.status === 'pending' ? (
                              <>
                                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleResolveReport(r.id, 'keep')}>
                                  Mantener
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleResolveReport(r.id, 'delete')}>
                                  Eliminar
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">Acción: {r.actionTaken === 'keep' ? 'Mantenido' : 'Eliminado'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {reports.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay reportes nuevos.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeView === "settings" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Configuración del Sistema</h2>
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Comisiones</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">Comisión Base</p>
                        <p className="text-sm text-slate-500">Porcentaje cobrado por cada reserva exitosa</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xl text-slate-900">{systemSettings.commission}%</span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">Editar</Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Editar Comisión</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Input 
                                type="number" 
                                defaultValue={systemSettings.commission} 
                                onBlur={(e) => handleUpdateSystemSetting('commission', Number(e.target.value))}
                                placeholder="Ej: 15" 
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Políticas</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">Política de Cancelación</p>
                        <p className="text-sm text-slate-500">{systemSettings.cancelationPolicy}</p>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">Editar</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Editar Política</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Input 
                              defaultValue={systemSettings.cancelationPolicy} 
                              onBlur={(e) => handleUpdateSystemSetting('cancelationPolicy', e.target.value)}
                              placeholder="Ej: 12h - 50% reembolso" 
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Mantenimiento</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">Modo Mantenimiento</p>
                        <p className="text-sm text-slate-500">Desactiva el acceso a la app para los usuarios</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={systemSettings.maintenanceMode ? "text-green-600 border-green-200" : "text-red-600 border-red-200 hover:bg-red-50"}
                        onClick={() => handleUpdateSystemSetting('maintenanceMode', !systemSettings.maintenanceMode)}
                      >
                        {systemSettings.maintenanceMode ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Administradores</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">Gestión de Roles</p>
                        <p className="text-sm text-slate-500">Añadir o remover administradores del sistema</p>
                      </div>
                      <Button variant="outline" size="sm">Gestionar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
