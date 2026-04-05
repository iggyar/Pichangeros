import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LogOut, Trophy, Users, MapPin, CalendarDays, DollarSign, ShieldAlert, Settings, CheckCircle2, XCircle, Eye, Shield, Activity, AlertCircle } from "lucide-react";
import { collection, query, getDocs, updateDoc, doc, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mock Data for Admin Panel
const MOCK_USERS = [
  { id: "USR-001", name: "Carlos Mendoza", email: "carlos.m@email.com", phone: "987654321", role: "user", registeredAt: "15/01/2026", status: "active" },
  { id: "USR-002", name: "Luis Ramírez", email: "luis.r@email.com", phone: "912345678", role: "owner", registeredAt: "20/01/2026", status: "active" },
  { id: "USR-003", name: "Jorge Silva", email: "jorge.s@email.com", phone: "998877665", role: "user", registeredAt: "05/02/2026", status: "suspended" },
  { id: "USR-004", name: "Miguel Ángel", email: "miguel.a@email.com", phone: "955443322", role: "owner", registeredAt: "10/02/2026", status: "active" },
  { id: "USR-005", name: "Diego Flores", email: "diego.f@email.com", phone: "933221100", role: "user", registeredAt: "25/02/2026", status: "active" },
];

const MOCK_COURTS = [
  { id: "CRT-001", name: "El Monumental", owner: "Luis Ramírez", district: "Miraflores", type: "Sintética", status: "approved", registeredAt: "22/01/2026" },
  { id: "CRT-002", name: "La Bombonera", owner: "Miguel Ángel", district: "San Borja", type: "Losa", status: "pending", registeredAt: "28/03/2026" },
  { id: "CRT-003", name: "Camp Nou", owner: "Ana Torres", district: "Surco", type: "Grass natural", status: "rejected", registeredAt: "15/03/2026" },
  { id: "CRT-004", name: "Wembley", owner: "Pedro Castillo", district: "San Isidro", type: "Sintética", status: "approved", registeredAt: "01/02/2026" },
];

const MOCK_RESERVATIONS = [
  { id: "RES-8921", player: "Carlos Mendoza", court: "El Monumental", date: "28/03/2026", time: "20:00", amount: "120.00", status: "completed" },
  { id: "RES-8915", player: "Jorge Silva", court: "Wembley", date: "27/03/2026", time: "19:00", amount: "90.00", status: "active" },
  { id: "RES-8890", player: "Diego Flores", court: "El Monumental", date: "25/03/2026", time: "21:00", amount: "150.00", status: "cancelled" },
];

const MOCK_PAYMENTS = [
  { id: "PAY-1029", date: "28/03/2026", reservationId: "RES-8921", player: "Carlos Mendoza", court: "El Monumental", total: 120.00, status: "completed" },
  { id: "PAY-1028", date: "27/03/2026", reservationId: "RES-8915", player: "Jorge Silva", court: "Wembley", total: 90.00, status: "processing" },
  { id: "PAY-1027", date: "25/03/2026", reservationId: "RES-8890", player: "Diego Flores", court: "El Monumental", total: 150.00, status: "refunded" },
];

const MOCK_DISPUTES = [
  { id: "DSP-001", user: "Carlos Mendoza", type: "Reembolso", description: "Cancha cerrada al llegar", status: "open" },
  { id: "DSP-002", user: "Luis Ramírez", type: "Comportamiento", description: "Jugadores causaron daños", status: "resolved" },
];

export default function AdminDashboard() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard");

  // In a real app, these would be fetched from Firestore
  const [users, setUsers] = useState(MOCK_USERS);
  const [courts, setCourts] = useState(MOCK_COURTS);
  const [reservations, setReservations] = useState(MOCK_RESERVATIONS);
  const [payments, setPayments] = useState(MOCK_PAYMENTS);
  const [disputes, setDisputes] = useState(MOCK_DISPUTES);

  const pendingCourts = courts.filter(c => c.status === "pending");

  const handleApproveCourt = (id: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, status: "approved" } : c));
    toast.success("Cancha aprobada exitosamente");
  };

  const handleRejectCourt = (id: string) => {
    setCourts(courts.map(c => c.id === id ? { ...c, status: "rejected" } : c));
    toast.success("Cancha rechazada");
  };

  const handleSuspendUser = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u));
    toast.success("Estado de usuario actualizado");
  };

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
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-red-400">
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
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Reservas Hoy</p>
                    <h3 className="text-2xl font-bold text-slate-900">12</h3>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Ingresos Semana</p>
                    <h3 className="text-2xl font-bold text-slate-900">S/ 4,250</h3>
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
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApproveCourt(court.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRejectCourt(court.id)}>
                                <XCircle className="w-4 h-4 mr-1" /> Rechazar
                              </Button>
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
              <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
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
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                          <td className="px-6 py-4 text-slate-600">{u.email}</td>
                          <td className="px-6 py-4 text-slate-600">{u.phone}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={u.role === 'owner' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>
                              {u.role === 'owner' ? 'Dueño' : 'Jugador'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{u.registeredAt}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                              {u.status === 'active' ? 'Activo' : 'Suspendido'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className={`h-8 w-8 ${u.status === 'active' ? 'text-slate-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}`} onClick={() => handleSuspendUser(u.id)}>
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
              <h2 className="text-2xl font-bold text-slate-900">Gestión de Canchas</h2>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <Tabs defaultValue="all" className="w-full">
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
                      {courts.map((c) => (
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
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600">
                              <Eye className="w-4 h-4" />
                            </Button>
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
            </div>
          )}

          {activeView === "reservations" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Todas las Reservas</h2>
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
                      {reservations.map((res) => (
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
                            <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
                              Ver Detalle
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

          {activeView === "payments" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">Gestión de Pagos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-blue-800 mb-1">Total Procesado (Mes)</p>
                    <h3 className="text-3xl font-bold text-blue-900">S/ 45,250.00</h3>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-green-800 mb-1">Comisión Plataforma (10%)</p>
                    <h3 className="text-3xl font-bold text-green-900">S/ 4,525.00</h3>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Fecha</th>
                        <th className="px-6 py-4 font-bold">ID Reserva</th>
                        <th className="px-6 py-4 font-bold">Jugador</th>
                        <th className="px-6 py-4 font-bold">Cancha</th>
                        <th className="px-6 py-4 font-bold">Monto Total</th>
                        <th className="px-6 py-4 font-bold text-blue-600">Comisión (10%)</th>
                        <th className="px-6 py-4 font-bold text-green-600">Pago Dueño (90%)</th>
                        <th className="px-6 py-4 font-bold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => {
                        const commission = p.total * 0.1;
                        const ownerPayout = p.total * 0.9;
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
              <h2 className="text-2xl font-bold text-slate-900">Soporte y Disputas</h2>
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">ID</th>
                        <th className="px-6 py-4 font-bold">Usuario</th>
                        <th className="px-6 py-4 font-bold">Tipo</th>
                        <th className="px-6 py-4 font-bold">Descripción</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {disputes.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.id}</td>
                          <td className="px-6 py-4 font-medium text-slate-900">{d.user}</td>
                          <td className="px-6 py-4 text-slate-600">{d.type}</td>
                          <td className="px-6 py-4 text-slate-600">{d.description}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`
                              ${d.status === 'open' ? 'border-amber-200 text-amber-700 bg-amber-50' : ''}
                              ${d.status === 'resolved' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                            `}>
                              {d.status === 'open' ? 'Abierta' : 'Resuelta'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Button size="sm" variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
                              Ver
                            </Button>
                            {d.status === 'open' && (
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
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
                        <span className="font-bold text-xl text-slate-900">10%</span>
                        <Button variant="outline" size="sm">Editar</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Integraciones</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">C</div>
                        <div>
                          <p className="font-bold text-slate-900">Culqi</p>
                          <p className="text-sm text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Conectado</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Configurar</Button>
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
