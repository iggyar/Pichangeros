import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Calendar, Clock, MapPin, QrCode, ShieldAlert, Trophy, Star, ArrowLeftRight, Upload, CreditCard, Info, AlertTriangle } from "lucide-react";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from "react-qr-code";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mock data
const MOCK_BOOKINGS = [
  {
    id: "b1",
    fieldName: "Canchas El Golazo",
    date: "2026-03-30",
    timeSlot: "20:00 - 21:00",
    price: 80,
    securityCode: "459812",
    status: "active",
    location: "Av. Javier Prado Este 123, San Borja"
  },
  {
    id: "b2",
    fieldName: "Pichanga Pro Surco",
    date: "2026-03-25",
    timeSlot: "19:00 - 20:00",
    price: 100,
    securityCode: "123456",
    status: "completed",
    location: "Av. Caminos del Inca 456, Surco"
  }
];

const LIMA_DISTRICTS = [
  "Miraflores", "San Borja", "San Isidro", "Surco", "La Molina", "San Miguel", 
  "Jesús María", "Lince", "Pueblo Libre", "Barranco", "Chorrillos", 
  "Villa El Salvador", "San Juan de Lurigancho", "Los Olivos", "Comas", 
  "Ate", "Santa Anita", "El Agustino", "Breña", "Cercado de Lima"
];

const POSITIONS = [
  "Arquero", "Defensa", "Volante", "Delantero", "Me da igual"
];

export default function UserDashboard() {
  const { user, profile, logout } = useAuth();
  const [activeView, setActiveView] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>(MOCK_BOOKINGS);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Profile states
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || "");
  const [district, setDistrict] = useState(profile?.district || "");
  const [favoritePosition, setFavoritePosition] = useState(profile?.favoritePosition || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setPhoneNumber(profile.phoneNumber || "");
      setDistrict(profile.district || "");
      setFavoritePosition(profile.favoritePosition || "");
    }
  }, [profile]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "bookings"), 
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedBookings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (fetchedBookings.length > 0) {
          setBookings(fetchedBookings);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  const activeBookings = bookings.filter(b => b.status === "active");
  const pastBookings = bookings.filter(b => b.status === "completed" || b.status === "cancelled");

  const navigate = useNavigate();

  const switchRole = async () => {
    if (!user) return;
    try {
      if (profile?.role !== "owner") {
        await updateDoc(doc(db, "users", user.uid), { role: "owner" });
      }
      toast.success("Cambiando a vista de Dueño...");
      navigate("/owner");
    } catch (error) {
      toast.error("Error al cambiar de vista");
    }
  };

  const handleCancelBooking = () => {
    if (!selectedBooking) return;
    
    // Update local state for demo
    setBookings(prev => prev.map(b => 
      b.id === selectedBooking.id ? { ...b, status: "cancelled" } : b
    ));
    
    toast.success("Reserva cancelada correctamente. El reembolso del 80% está en proceso.");
    setIsCancelModalOpen(false);
    setSelectedBooking(null);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        phoneNumber,
        district,
        favoritePosition
      });
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 1MB to avoid Firestore limits)
    if (file.size > 1024 * 1024) {
      toast.error("La imagen es muy grande. Máximo 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "users", user.uid), {
          photoURL: base64String
        });
        toast.success("Foto de perfil actualizada");
      } catch (error) {
        console.error("Error uploading photo:", error);
        toast.error("Error al actualizar la foto");
      }
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      const formatted = format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-600" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Pichangeros</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 hidden sm:block">
              Hola, {profile?.displayName || "Jugador"}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="bg-slate-900 p-6 text-center text-white">
                <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold overflow-hidden">
                  {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "J"}
                </div>
                <h2 className="font-bold text-lg">{profile?.displayName || "Jugador"}</h2>
                <p className="text-slate-400 text-sm">{profile?.email}</p>
              </div>
              <div className="p-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("bookings")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "bookings" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mis Reservas
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("profile")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "profile" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mi Perfil
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("payments")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "payments" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Métodos de Pago
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("support")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "support" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Soporte
                </Button>
                
                <div className="my-4 border-t border-slate-100"></div>
                
                <Button 
                  variant="outline" 
                  onClick={switchRole}
                  className="w-full justify-start rounded-xl h-12 border-green-200 text-green-700 hover:bg-green-50"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Cambiar a Dueño
                </Button>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeView === "bookings" && (
              <div>
                {/* Prominent Search Banner */}
                <Card className="bg-gradient-to-br from-green-600 to-green-800 border-none shadow-xl shadow-green-900/20 rounded-3xl overflow-hidden mb-8 relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                  <CardContent className="p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="text-white text-center sm:text-left">
                      <h2 className="text-2xl sm:text-3xl font-black mb-2 drop-shadow-sm">¿Listo para la próxima pichanga?</h2>
                      <p className="text-green-100 text-lg max-w-md">Encuentra las mejores canchas cerca de ti y reserva al instante.</p>
                    </div>
                    <Link to="/search" className="w-full sm:w-auto shrink-0">
                      <Button size="lg" className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 rounded-full text-lg px-8 h-14 shadow-lg border-none font-bold">
                        <MapPin className="w-5 h-5 mr-2" />
                        Buscar Canchas
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">Mis Reservas</h1>
                </div>

                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                    <TabsTrigger value="active">Próximas ({activeBookings.length})</TabsTrigger>
                    <TabsTrigger value="past">Pasadas ({pastBookings.length})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="space-y-4">
                    {activeBookings.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No tienes reservas próximas</h3>
                        <p className="text-slate-500 mb-6">¡Es hora de armar la pichanga!</p>
                        <Link to="/search">
                          <Button className="bg-green-600 hover:bg-green-700 rounded-full">Buscar canchas</Button>
                        </Link>
                      </div>
                    ) : (
                      activeBookings.map(booking => (
                        <Card key={booking.id} className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            <div className="bg-green-600 text-white p-6 flex flex-col items-center justify-center md:w-48 shrink-0">
                              <div className="bg-white p-2 rounded-xl mb-3">
                                <QRCode value={booking.securityCode} size={80} level="H" />
                              </div>
                              <span className="text-xs uppercase tracking-wider font-bold opacity-90 mb-1 text-center">Código de acceso</span>
                              <span className="text-2xl font-black tracking-widest">{booking.securityCode}</span>
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className="text-xl font-bold text-slate-900">{booking.fieldName}</h3>
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmada</Badge>
                                </div>
                                <div className="space-y-2 text-slate-600 mb-6">
                                  <p className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> {formatDate(booking.date)}
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> {booking.timeSlot}
                                  </p>
                                  <p className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> {booking.location || "Ver en mapa"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-3 mt-auto">
                                <Button 
                                  variant="outline" 
                                  className="border-slate-200 text-slate-600 hover:bg-slate-50"
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsDetailsModalOpen(true);
                                  }}
                                >
                                  Ver detalles
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsCancelModalOpen(true);
                                  }}
                                >
                                  Cancelar reserva
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="past" className="space-y-4">
                    {pastBookings.map(booking => (
                      <Card key={booking.id} className="border-slate-200 shadow-sm rounded-2xl opacity-75 hover:opacity-100 transition-opacity">
                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-slate-900">{booking.fieldName}</h3>
                              <Badge variant="outline" className={booking.status === "completed" ? "text-slate-500" : "text-red-500 border-red-200"}>
                                {booking.status === "completed" ? "Completada" : "Cancelada"}
                              </Badge>
                            </div>
                            <p className="text-slate-500 text-sm">
                              {formatDate(booking.date)} • {booking.timeSlot}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {booking.status === "completed" && (
                              <Button variant="outline" className="border-yellow-200 text-yellow-600 hover:bg-yellow-50">
                                <Star className="w-4 h-4 mr-2" />
                                Calificar
                              </Button>
                            )}
                            <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50">
                              Volver a reservar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {activeView === "profile" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Mi Perfil</h2>
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-slate-900 to-slate-700 w-full relative">
                    <div className="absolute -bottom-12 left-8">
                      <div className="w-24 h-24 bg-white rounded-full p-1 shadow-xl">
                        <div className="w-full h-full bg-slate-200 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold text-slate-500">
                          {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "J"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-8 pt-16 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{profile?.displayName || "Jugador"}</h3>
                        <p className="text-slate-500 font-medium">{user?.email}</p>
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          id="photo-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handlePhotoUpload}
                        />
                        <Label htmlFor="photo-upload" className="cursor-pointer">
                          <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            <Upload className="w-4 h-4 mr-2" />
                            Cambiar Foto
                          </div>
                        </Label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Información Personal</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Nombre Completo</Label>
                            <Input 
                              value={displayName} 
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Correo Electrónico</Label>
                            <Input value={user?.email || ""} disabled className="h-12 rounded-xl bg-slate-100 text-slate-500 border-slate-200" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Número de Teléfono</Label>
                            <Input 
                              placeholder="+51 999 999 999" 
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Preferencias de Juego</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Distrito Principal</Label>
                            <Select value={district} onValueChange={setDistrict}>
                              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-green-500">
                                <SelectValue placeholder="Selecciona tu distrito" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {LIMA_DISTRICTS.map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Posición Favorita</Label>
                            <Select value={favoritePosition} onValueChange={setFavoritePosition}>
                              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-green-500">
                                <SelectValue placeholder="¿De qué juegas?" />
                              </SelectTrigger>
                              <SelectContent>
                                {POSITIONS.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                      <Button 
                        className="bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl text-base font-bold shadow-lg shadow-green-600/20" 
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? "Guardando..." : "Guardar Cambios"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === "payments" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Métodos de Pago</h2>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Tus Tarjetas</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                      Añade y gestiona tus métodos de pago para reservar canchas más rápido.
                    </p>
                    <Button className="bg-green-600 hover:bg-green-700">Añadir Tarjeta</Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === "support" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Soporte</h2>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Centro de Ayuda</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                      ¿Tienes algún problema con una reserva o necesitas ayuda con tu cuenta?
                    </p>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => toast.success("Abriendo centro de soporte...")}>Contactar Soporte</Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Detalles de la Reserva</DialogTitle>
            <DialogDescription>
              Información completa de tu pichanga.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-lg text-slate-900 mb-1">{selectedBooking.fieldName}</h3>
                <p className="text-slate-500 flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" /> {selectedBooking.location}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Fecha</p>
                  <p className="font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-600" /> {formatDate(selectedBooking.date)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Hora</p>
                  <p className="font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-600" /> {selectedBooking.timeSlot}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex flex-col items-center justify-center text-center">
                <div className="bg-white p-3 rounded-2xl shadow-sm mb-4 border border-green-100">
                  <QRCode value={selectedBooking.securityCode} size={120} level="H" />
                </div>
                <p className="text-sm text-green-800 font-medium mb-1">Código de Acceso</p>
                <p className="text-4xl font-black tracking-widest text-green-700">{selectedBooking.securityCode}</p>
                <p className="text-xs text-green-600 mt-2">Muestra este código al llegar al establecimiento</p>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Total pagado</span>
                <span className="text-xl font-bold text-slate-900">S/ {selectedBooking.price}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setIsDetailsModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Cancelar Reserva
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-base pt-2">
              ¿Estás seguro que deseas cancelar tu reserva en <strong>{selectedBooking?.fieldName}</strong> para el <strong>{selectedBooking ? formatDate(selectedBooking.date) : ''}</strong> a las <strong>{selectedBooking?.timeSlot}</strong>?
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 my-4">
            <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
              <Info className="w-5 h-5" />
              Política de Cancelación
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              De acuerdo con nuestros términos y condiciones, al cancelar una reserva confirmada, <strong>solo se reembolsará el 80% del monto total pagado (S/ {selectedBooking ? (selectedBooking.price * 0.8).toFixed(2) : '0.00'})</strong>. 
              <br/><br/>
              El 20% restante es retenido en concepto de compensación para el establecimiento deportivo por el tiempo bloqueado y la potencial pérdida de ingresos.
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 mt-2">
            <Button variant="outline" className="w-full sm:w-1/2 rounded-xl border-slate-200" onClick={() => setIsCancelModalOpen(false)}>
              Mantener reserva
            </Button>
            <Button variant="destructive" className="w-full sm:w-1/2 rounded-xl bg-red-600 hover:bg-red-700" onClick={handleCancelBooking}>
              Sí, cancelar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
