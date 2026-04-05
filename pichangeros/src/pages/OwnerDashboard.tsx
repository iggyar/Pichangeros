import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, Clock, MapPin, QrCode, ShieldAlert, Trophy, CheckCircle2, Plus, Settings, DollarSign, Upload, X, CalendarDays, ChevronRight, ChevronLeft, Image as ImageIcon, ChevronDown, ArrowLeftRight } from "lucide-react";
import { collection, query, where, getDocs, orderBy, updateDoc, doc, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LIMA_DISTRICTS = [
  "Miraflores", "San Borja", "San Isidro", "Surco", "La Molina", "San Miguel", 
  "Jesús María", "Lince", "Pueblo Libre", "Barranco", "Chorrillos", 
  "Villa El Salvador", "San Juan de Lurigancho", "Los Olivos", "Comas", 
  "Ate", "Santa Anita", "El Agustino", "Breña", "Cercado de Lima"
];

const PAYMENT_METHODS = [
  "Yape", "Plin", "Transferencia bancaria"
];

export default function OwnerDashboard() {
  const { user, profile, logout } = useAuth();
  const [fields, setFields] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [codeToConfirm, setCodeToConfirm] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [editingField, setEditingField] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scheduleField, setScheduleField] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, string>>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [defaultOpenTime, setDefaultOpenTime] = useState("08:00");
  const [defaultCloseTime, setDefaultCloseTime] = useState("23:00");

  // Profile states
  const [district, setDistrict] = useState(profile?.district || "");
  const [paymentMethod, setPaymentMethod] = useState(profile?.paymentMethod || "");
  const [paymentAccount, setPaymentAccount] = useState(profile?.paymentAccount || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Field attributes states
  const [surfaceType, setSurfaceType] = useState<string>("");
  const [roofType, setRoofType] = useState<string>("");
  const [lighting, setLighting] = useState<string>("");
  const [fieldSize, setFieldSize] = useState<string>("");
  const [extras, setExtras] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setDistrict(profile.district || "");
      setPaymentMethod(profile.paymentMethod || "");
      setPaymentAccount(profile.paymentAccount || "");
    }
  }, [profile]);

  const ALL_HOURS = Array.from({ length: 24 }).map((_, i) => {
    const start = i.toString().padStart(2, '0') + ":00";
    const end = ((i + 1) % 24 === 0 ? 24 : (i + 1)).toString().padStart(2, '0') + ":00";
    return `${start} - ${end}`;
  }).filter(slot => {
    const startHour = parseInt(slot.split(":")[0]);
    const openHour = parseInt(defaultOpenTime.split(":")[0]);
    const closeHour = parseInt(defaultCloseTime.split(":")[0]);
    
    if (openHour <= closeHour) {
      return startHour >= openHour && startHour < closeHour;
    } else {
      return startHour >= openHour || startHour < closeHour;
    }
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3 - uploadedImages.length);
      const newImages = files.map(file => URL.createObjectURL(file as Blob));
      setUploadedImages(prev => [...prev, ...newImages].slice(0, 3));
      if (uploadedImages.length === 0 && newImages.length > 0) {
        setCurrentImageIndex(0);
      }
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageIndex >= newImages.length) {
        setCurrentImageIndex(Math.max(0, newImages.length - 1));
      }
      return newImages;
    });
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % uploadedImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + uploadedImages.length) % uploadedImages.length);
  };

  useEffect(() => {
    if (scheduleField) {
      setScheduleData(scheduleField.scheduleData || {});
      setDefaultOpenTime(scheduleField.defaultOpenTime || "08:00");
      setDefaultCloseTime(scheduleField.defaultCloseTime || "22:00");
    }
  }, [scheduleField]);

  const saveSchedule = async () => {
    if (!scheduleField) return;
    try {
      await updateDoc(doc(db, "fields", scheduleField.id), {
        scheduleData,
        defaultOpenTime,
        defaultCloseTime,
        updatedAt: serverTimestamp()
      });
      toast.success("Horario guardado exitosamente");
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Error al guardar el horario");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get("displayName") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const businessName = formData.get("businessName") as string;
    const businessId = formData.get("businessId") as string;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        phoneNumber,
        businessName,
        businessId,
        district,
        paymentMethod,
        paymentAccount,
        updatedAt: serverTimestamp()
      });
      toast.success("Perfil actualizado exitosamente");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUploadProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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

  const handleIdentityUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 1024 * 1024) {
      toast.error("El documento es muy grande. Máximo 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "users", user.uid), {
          identityDocumentUrl: base64String,
          identityVerified: false // Needs admin approval
        });
        toast.success("Documento subido. En revisión.");
      } catch (error) {
        console.error("Error uploading identity document:", error);
        toast.error("Error al subir el documento");
      }
    };
    reader.readAsDataURL(file);
  };

  const isWithinDefaultHours = (slot: string) => {
    const startHour = parseInt(slot.split(":")[0]);
    const openHour = parseInt(defaultOpenTime.split(":")[0]);
    const closeHour = parseInt(defaultCloseTime.split(":")[0]);
    
    if (openHour <= closeHour) {
      return startHour >= openHour && startHour < closeHour;
    } else {
      return startHour >= openHour || startHour < closeHour;
    }
  };

  const getSlotStatus = (date: Date, slot: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const explicitStatus = scheduleData[dateStr]?.[slot];
    if (explicitStatus) return explicitStatus;
    
    return isWithinDefaultHours(slot) ? 'open' : 'closed';
  };

  const setSlotStatus = (date: Date, slot: string, status: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setScheduleData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [slot]: status
      }
    }));
  };

  const toggleSlotStatus = (date: Date, slot: string) => {
    const current = getSlotStatus(date, slot);
    const next = current === 'open' ? 'closed' : current === 'closed' ? 'reserved' : 'open';
    setSlotStatus(date, slot, next);
  };

  const TIME_SLOTS = ["18:00 - 19:00", "19:00 - 20:00", "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00"];
  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    const fieldsQ = query(collection(db, "fields"), where("ownerId", "==", user.uid));
    const unsubscribeFields = onSnapshot(fieldsQ, async (snap) => {
      const fetchedFields = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFields(fetchedFields);
      setLoading(false);

      // Auto-approve pending fields if identity is verified
      if (profile?.identityVerified) {
        const pendingFields = fetchedFields.filter(f => f.status === "pending");
        for (const field of pendingFields) {
          try {
            await updateDoc(doc(db, "fields", field.id), {
              status: "approved",
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Error auto-approving field:", err);
          }
        }
      }
    }, (error) => {
      console.error("Error fetching fields:", error);
      setLoading(false);
    });

    const bookingsQ = query(
      collection(db, "bookings"), 
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribeBookings = onSnapshot(bookingsQ, (snap) => {
      const fetchedBookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(fetchedBookings);
    }, (error) => {
      console.error("Error fetching bookings:", error);
    });

    return () => {
      unsubscribeFields();
      unsubscribeBookings();
    };
  }, [user, profile?.identityVerified]);

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeToConfirm) return;

    const booking = bookings.find(b => b.securityCode === codeToConfirm && b.status === "active");
    
    if (!booking) {
      toast.error("Código inválido o reserva ya completada");
      return;
    }

    try {
      await updateDoc(doc(db, "bookings", booking.id), { 
        status: "completed", 
        paymentStatus: "released",
        updatedAt: serverTimestamp()
      });
      
      toast.success("Código confirmado. Pago liberado (90%)");
      setCodeToConfirm("");
    } catch (error) {
      console.error("Error confirming code:", error);
      toast.error("Error al confirmar el código");
    }
  };

  const handleSaveField = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const pricePerHour = Number(formData.get("pricePerHour"));
    const address = formData.get("address") as string;

    if (!name || !description || !pricePerHour || !address) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const initialStatus = profile?.identityVerified ? "approved" : "pending";

    try {
      if (activeView === "new_field") {
        await addDoc(collection(db, "fields"), {
          ownerId: user.uid,
          name,
          description,
          pricePerHour,
          location: { address },
          surfaceType,
          roofType,
          lighting,
          fieldSize,
          extras,
          status: initialStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success(initialStatus === "approved" ? "Cancha creada y activada" : "Cancha creada y enviada a revisión");
      } else if (editingField) {
        await updateDoc(doc(db, "fields", editingField.id), {
          name,
          description,
          pricePerHour,
          location: { address },
          surfaceType,
          roofType,
          lighting,
          fieldSize,
          extras,
          status: initialStatus,
          rejectionReason: null, // Clear rejection reason
          updatedAt: serverTimestamp(),
        });
        toast.success(initialStatus === "approved" ? "Cancha actualizada y activada" : "Cancha actualizada y reenviada a revisión");
      }
      setActiveView("fields");
    } catch (error) {
      console.error("Error saving field:", error);
      toast.error("Error al guardar la cancha");
    }
  };

  const activeBookings = bookings.filter(b => b.status === "active");
  const completedBookings = bookings.filter(b => b.status === "completed");

  const navigate = useNavigate();

  const switchRole = async () => {
    if (!user) return;
    try {
      toast.success("Cambiando a vista de Jugador...");
      navigate("/dashboard");
    } catch (error) {
      toast.error("Error al cambiar de vista");
    }
  };

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  const weeklyBookings = bookings.filter(b => {
    const bookingDate = new Date(b.date);
    return bookingDate >= last7Days && bookingDate <= new Date() && b.status === "completed";
  });
  
  const weeklyIncome = weeklyBookings.reduce((acc, b) => acc + ((b.price || 0) * 0.9), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validatedToday = bookings
    .filter(b => b.status === "completed" && b.updatedAt && b.updatedAt.toDate() >= today)
    .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold tracking-tight">Pichangeros <span className="text-green-400 text-sm font-normal">Socios</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-sm font-bold text-green-400">
                {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
              </div>
              <span className="text-sm font-medium text-slate-300 hidden sm:block">
                {profile?.displayName || "Dueño"}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center text-white">
                <div className="w-24 h-24 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-green-400 border-4 border-slate-800 overflow-hidden shadow-inner">
                  {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
                </div>
                <h2 className="font-bold text-lg">{profile?.displayName || "Dueño"}</h2>
                <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">Socio Verificado</Badge>
              </div>
              <div className="p-3 space-y-1">
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("profile")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "profile" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mi Perfil
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("dashboard")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "dashboard" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Panel Principal
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("fields")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "fields" || activeView === "schedule" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mis Canchas
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("finance")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "finance" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Historial de Pagos
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
                  Cambiar a Jugador
                </Button>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-8">
            
            {activeView === "dashboard" && (
              <>
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Reservas Hoy</p>
                    <h3 className="text-2xl font-bold text-slate-900">{activeBookings.length + completedBookings.length}</h3>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Ingresos Estimados</p>
                    <h3 className="text-2xl font-bold text-slate-900">S/ {bookings.reduce((acc, b) => acc + ((b.price || 0) * 0.9), 0).toFixed(2)}</h3>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Completadas</p>
                    <h3 className="text-2xl font-bold text-slate-900">{completedBookings.length}</h3>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-400" />
                    Resumen Semanal (Últimos 7 días)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Total Reservas</p>
                      <p className="text-3xl font-bold">{weeklyBookings.length}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Ingresos Generados</p>
                      <p className="text-3xl font-bold text-green-400">S/ {weeklyIncome.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Validate Code Section */}
            <Card className="border-green-200 bg-green-50 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-green-900 mb-2 flex items-center gap-2">
                    <QrCode className="w-6 h-6" />
                    Validar ingreso de jugadores
                  </h3>
                  <p className="text-green-700">Ingresa el código de 6 dígitos que el usuario te mostrará al llegar a la cancha para liberar tu pago.</p>
                </div>
                <form onSubmit={handleConfirmCode} className="flex w-full md:w-auto gap-2">
                  <Input 
                    placeholder="Ej: 459812" 
                    className="bg-white border-green-300 focus-visible:ring-green-600 text-lg tracking-widest text-center w-full md:w-48 h-12"
                    value={codeToConfirm}
                    onChange={(e) => setCodeToConfirm(e.target.value)}
                    maxLength={6}
                  />
                  <Button type="submit" className="bg-green-600 hover:bg-green-700 h-12 px-6 rounded-xl">
                    Validar
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Validated Today History */}
            {validatedToday.length > 0 && (
              <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Últimos códigos validados hoy
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {validatedToday.map(booking => (
                    <div key={booking.id} className="p-4 px-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-900">{booking.fieldName}</p>
                        <p className="text-sm text-slate-500">{booking.userName} • {booking.timeSlot}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-800 mb-1">Validado</Badge>
                        <p className="text-xs text-slate-400">
                          {booking.updatedAt ? new Date(booking.updatedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Bookings List */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Reservas de Hoy</h2>
                <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full">
                  Ver calendario completo
                </Button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold">Horario</th>
                        <th className="px-6 py-4 font-bold">Jugador</th>
                        <th className="px-6 py-4 font-bold">Cancha</th>
                        <th className="px-6 py-4 font-bold">Estado</th>
                        <th className="px-6 py-4 font-bold">Pago</th>
                        <th className="px-6 py-4 font-bold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                            {booking.timeSlot}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {booking.userName}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {fields.find(f => f.id === booking.fieldId)?.name || "Cancha Eliminada"}
                          </td>
                          <td className="px-6 py-4">
                            {booking.status === "active" ? (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Pendiente</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completada</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {booking.paymentStatus === "held" ? (
                              <span className="text-amber-600 font-medium flex items-center gap-1"><Clock className="w-3 h-3"/> Retenido</span>
                            ) : (
                              <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Liberado</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {booking.status === "active" ? (
                              <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setCodeToConfirm(booking.securityCode)}>
                                Validar
                              </Button>
                            ) : (
                              <span className="text-slate-400 text-sm">Validado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
              </>
            )}

            {activeView === "fields" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Mis Canchas</h2>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-xl" onClick={() => { setEditingField(null); setUploadedImages([]); setActiveView("new_field"); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Cancha
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map(field => (
                    <Card key={field.id} className={`border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden transition-colors group ${field.status === 'approved' ? 'hover:border-green-300 cursor-pointer' : 'opacity-80'}`} onClick={() => { if (field.status === 'approved') { setScheduleField(field); setActiveView("schedule"); } }}>
                      <CardContent className="p-0 flex flex-col">
                        <div className="w-full h-56 bg-slate-200 relative overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop" alt={field.name} className={`w-full h-full object-cover transition-transform duration-500 ${field.status === 'approved' ? 'group-hover:scale-105' : ''}`} />
                          {field.status === 'approved' && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                              <p className="text-white font-medium flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" />
                                Haz clic para ver horarios
                              </p>
                            </div>
                          )}
                          <div className="absolute top-4 right-4">
                            {field.status === "approved" && <Badge className="bg-green-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Activa</Badge>}
                            {field.status === "pending" && <Badge className="bg-blue-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Pendiente</Badge>}
                            {field.status === "rejected" && <Badge className="bg-red-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Rechazada</Badge>}
                            {field.status === "inactive" && <Badge className="bg-slate-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Inactiva</Badge>}
                          </div>
                        </div>
                        <div className="p-6 flex flex-col justify-between flex-1 bg-white">
                          <div>
                            <h3 className="font-bold text-2xl text-slate-900 mb-1">{field.name}</h3>
                            <p className="text-green-600 font-bold text-lg">S/ {field.pricePerHour} <span className="text-slate-500 text-sm font-normal">/ hora</span></p>
                            
                            {/* Field Attributes Summary */}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {field.surfaceType && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.surfaceType}</Badge>
                              )}
                              {field.fieldSize && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.fieldSize}</Badge>
                              )}
                              {field.roofType && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.roofType}</Badge>
                              )}
                            </div>

                            {field.status === "rejected" && field.rejectionReason && (
                              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-sm text-red-800 font-medium flex items-start gap-2">
                                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                  <span><strong>Motivo de rechazo:</strong> {field.rejectionReason}</span>
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                            <Button 
                              variant="ghost" 
                              disabled={field.status !== 'approved'} 
                              className="text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-xl font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleField(field);
                                setActiveView("schedule");
                              }}
                            >
                              <CalendarDays className="w-4 h-4 mr-2" />
                              Ver Horarios
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700" onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingField(field);
                              setSurfaceType(field.surfaceType || "");
                              setRoofType(field.roofType || "");
                              setLighting(field.lighting || "");
                              setFieldSize(field.fieldSize || "");
                              setExtras(field.extras || []);
                              setUploadedImages(["https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop"]); 
                              setActiveView("edit_field"); 
                            }}>
                              Editar Cancha
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeView === "schedule" && scheduleField && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setActiveView("fields")} className="rounded-full bg-white shadow-sm border border-slate-200">
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Horarios: {scheduleField.name}</h2>
                      <p className="text-slate-500">Gestiona la disponibilidad de tu cancha</p>
                    </div>
                  </div>
                  <Button onClick={saveSchedule} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 px-6">
                    Guardar Cambios
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Settings / Fixed Schedule */}
                  <div className="lg:col-span-1 space-y-6">
                    <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl">
                      <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Settings className="w-5 h-5 text-slate-500" />
                          Horario Fijo (Todos los días)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-slate-500">Define tu horario de atención. Fuera de este horario, la cancha aparecerá como <strong>Cerrada</strong> por defecto.</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold">Hora de Apertura</Label>
                            <Input type="time" value={defaultOpenTime} onChange={(e) => setDefaultOpenTime(e.target.value)} className="h-12 rounded-xl bg-slate-50 text-lg font-medium" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold">Hora de Cierre</Label>
                            <Input type="time" value={defaultCloseTime} onChange={(e) => setDefaultCloseTime(e.target.value)} className="h-12 rounded-xl bg-slate-50 text-lg font-medium" />
                          </div>
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12" onClick={saveSchedule}>
                            Guardar Horario Fijo
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Days Accordion */}
                  <div className="lg:col-span-2 space-y-4">
                    {nextDays.map((day, idx) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isExpanded = expandedDay === dateStr;
                      
                      return (
                        <Card key={idx} className="border-slate-200 shadow-sm rounded-2xl overflow-hidden transition-all">
                          <button
                            onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
                            className={`w-full flex items-center justify-between p-6 transition-colors ${isExpanded ? "bg-green-600 text-white" : "bg-white hover:bg-slate-50 text-slate-900"}`}
                          >
                            <div className="text-left flex items-center gap-4">
                              <CalendarDays className={`w-6 h-6 ${isExpanded ? "text-green-200" : "text-slate-400"}`} />
                              <div>
                                <p className={`text-sm font-bold uppercase tracking-wider ${isExpanded ? "text-green-100" : "text-slate-500"}`}>
                                  {format(day, "EEEE", { locale: es })}
                                </p>
                                <p className={`text-xl font-bold ${isExpanded ? "text-white" : "text-slate-900"}`}>
                                  {format(day, "d 'de' MMMM", { locale: es })}
                                </p>
                              </div>
                            </div>
                            <ChevronDown className={`w-6 h-6 transition-transform ${isExpanded ? "rotate-180 text-green-200" : "text-slate-400"}`} />
                          </button>
                          
                          {isExpanded && (
                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                              <div className="flex gap-4 mb-6 justify-end text-xs font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1 text-green-700"><div className="w-3 h-3 rounded-full bg-green-500"></div> Abierto</span>
                                <span className="flex items-center gap-1 text-red-700"><div className="w-3 h-3 rounded-full bg-red-500"></div> Cerrado</span>
                                <span className="flex items-center gap-1 text-blue-700"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Reservado</span>
                              </div>
                              
                              <div className="space-y-3">
                                {ALL_HOURS.map(slot => {
                                  const status = getSlotStatus(day, slot);
                                  return (
                                    <div key={slot} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white shadow-sm gap-4">
                                      <span className="font-bold text-slate-700 text-lg">{slot}</span>
                                      <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'open')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'open' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Abierto
                                        </button>
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'closed')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'closed' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Cerrado
                                        </button>
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'reserved')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'reserved' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Reservado
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeView === "finance" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Historial de Pagos</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-green-800 mb-1">Total Esta Semana</p>
                      <h3 className="text-3xl font-bold text-green-900">S/ 450.00</h3>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm rounded-2xl">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-slate-500 mb-1">Total Este Mes</p>
                      <h3 className="text-3xl font-bold text-slate-900">S/ 1,850.00</h3>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm rounded-2xl">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-slate-500 mb-1">Total Todo el Tiempo</p>
                      <h3 className="text-3xl font-bold text-slate-900">S/ 12,450.00</h3>
                    </CardContent>
                  </Card>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 text-blue-800">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">Los pagos se depositan directamente a tu cuenta bancaria registrada cada lunes.</p>
                </div>

                <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="font-bold text-slate-900">Pagos Realizados</h3>
                    <Tabs defaultValue="week" className="w-full sm:w-auto">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="week">Esta semana</TabsTrigger>
                        <TabsTrigger value="month">Este mes</TabsTrigger>
                        <TabsTrigger value="all">Todo el tiempo</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold">Fecha</th>
                          <th className="px-6 py-4 font-bold">ID Reserva</th>
                          <th className="px-6 py-4 font-bold">Jugador</th>
                          <th className="px-6 py-4 font-bold">Monto (S/)</th>
                          <th className="px-6 py-4 font-bold text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { id: "RES-8921", date: "28/03/2026", player: "Carlos Mendoza", amount: "120.00" },
                          { id: "RES-8915", date: "27/03/2026", player: "Luis Ramírez", amount: "90.00" },
                          { id: "RES-8890", date: "25/03/2026", player: "Jorge Silva", amount: "150.00" },
                          { id: "RES-8872", date: "22/03/2026", player: "Miguel Ángel", amount: "120.00" },
                          { id: "RES-8850", date: "20/03/2026", player: "Diego Flores", amount: "80.00" },
                          { id: "RES-8812", date: "18/03/2026", player: "Andrés Vargas", amount: "100.00" },
                          { id: "RES-8799", date: "15/03/2026", player: "Roberto Castro", amount: "120.00" },
                        ].map((payment, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-600">{payment.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{payment.id}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{payment.player}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">S/ {payment.amount}</td>
                            <td className="px-6 py-4 text-right">
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Pagado</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

            {activeView === "profile" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Mi Perfil</h2>
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-green-600 to-green-400 w-full relative">
                    <div className="absolute -bottom-12 left-8">
                      <div className="w-24 h-24 bg-white rounded-full p-1 shadow-xl">
                        <div className="w-full h-full bg-slate-200 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold text-slate-500">
                          {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-8 pt-16 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{profile?.displayName || "Dueño"}</h3>
                        <p className="text-slate-500 font-medium">{user?.email}</p>
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          id="owner-photo-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handlePhotoUploadProfile}
                        />
                        <Label htmlFor="owner-photo-upload" className="cursor-pointer">
                          <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            <Upload className="w-4 h-4 mr-2" />
                            Cambiar Foto
                          </div>
                        </Label>
                      </div>
                    </div>
                    
                    <form onSubmit={handleSaveProfile}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Información Personal</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Nombre Completo</Label>
                              <Input name="displayName" defaultValue={profile?.displayName || ""} className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Correo Electrónico</Label>
                              <Input defaultValue={user?.email || ""} disabled className="h-12 rounded-xl bg-slate-100 text-slate-500 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Número Personal</Label>
                              <Input name="phoneNumber" defaultValue={profile?.phoneNumber || ""} placeholder="+51 999 999 999" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
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
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Información del Negocio</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Razón Social</Label>
                              <Input name="businessName" defaultValue={profile?.businessName || ""} placeholder="Nombre de tu empresa" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Número de Negocio (RUC/DNI)</Label>
                              <Input name="businessId" defaultValue={profile?.businessId || ""} placeholder="10... / 20..." className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Método de Cobro Preferido</Label>
                              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-green-500">
                                  <SelectValue placeholder="Selecciona un método" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {paymentMethod && (
                              <div className="space-y-2">
                                <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">
                                  {paymentMethod === "Transferencia bancaria" ? "Número de Cuenta (CCI)" : "Número de Teléfono"}
                                </Label>
                                <Input 
                                  value={paymentAccount} 
                                  onChange={(e) => setPaymentAccount(e.target.value)}
                                  placeholder={paymentMethod === "Transferencia bancaria" ? "000-000-000000000000-00" : "+51 999 999 999"} 
                                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 space-y-6">
                        <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Verificación de Identidad</h4>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div>
                            <p className="text-slate-900 font-bold mb-1">Documento de Identidad (DNI o RUC)</p>
                            <p className="text-sm text-slate-500">Requerido para que tus canchas pasen de Pendiente a Activa.</p>
                            {profile?.identityVerified ? (
                              <Badge className="mt-2 bg-green-100 text-green-800 hover:bg-green-100">Verificado</Badge>
                            ) : profile?.identityDocumentUrl ? (
                              <Badge className="mt-2 bg-blue-100 text-blue-800 hover:bg-blue-100">En revisión</Badge>
                            ) : (
                              <Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <input 
                              type="file" 
                              id="identity-upload" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleIdentityUpload}
                            />
                            <Label htmlFor="identity-upload" className="cursor-pointer">
                              <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                                <Upload className="w-4 h-4 mr-2" />
                                Subir Documento
                              </div>
                            </Label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100 flex justify-end mt-8">
                        <Button type="submit" disabled={isSavingProfile} className="bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl text-base font-bold shadow-lg shadow-green-600/20">
                          {isSavingProfile ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {(activeView === "new_field" || activeView === "edit_field") && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {activeView === "new_field" ? "Nueva Cancha" : "Editar Cancha"}
                  </h2>
                  <Button variant="outline" onClick={() => setActiveView("fields")} className="rounded-xl">
                    Cancelar
                  </Button>
                </div>
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-700 font-bold text-lg">Fotos de la Cancha</Label>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{uploadedImages.length} de 3 permitidas</span>
                      </div>
                      
                      {uploadedImages.length > 0 ? (
                        <div className="space-y-4">
                          {/* Main Slider View */}
                          <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 group shadow-lg">
                            <img 
                              src={uploadedImages[currentImageIndex]} 
                              alt={`Cancha ${currentImageIndex + 1}`} 
                              className="w-full h-full object-cover transition-opacity duration-300" 
                            />
                            
                            {/* Slider Controls */}
                            {uploadedImages.length > 1 && (
                              <>
                                <button 
                                  onClick={(e) => { e.preventDefault(); prevImage(); }}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                >
                                  <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { e.preventDefault(); nextImage(); }}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                >
                                  <ChevronRight className="w-6 h-6" />
                                </button>
                                
                                {/* Indicators */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                  {uploadedImages.map((_, idx) => (
                                    <button 
                                      key={idx}
                                      onClick={(e) => { e.preventDefault(); setCurrentImageIndex(idx); }}
                                      className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImageIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                                    />
                                  ))}
                                </div>
                              </>
                            )}
                            
                            {/* Delete Button */}
                            <button 
                              onClick={(e) => { e.preventDefault(); removeImage(currentImageIndex); }} 
                              className="absolute top-4 right-4 bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors shadow-lg"
                              title="Eliminar esta foto"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Thumbnails & Add More */}
                          <div className="flex gap-4 overflow-x-auto pb-2">
                            {uploadedImages.map((img, idx) => (
                              <button 
                                key={idx}
                                onClick={(e) => { e.preventDefault(); setCurrentImageIndex(idx); }}
                                className={`relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${idx === currentImageIndex ? "border-green-500 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
                              >
                                <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                            
                            {uploadedImages.length < 3 && (
                              <label className="w-24 h-24 shrink-0 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-colors bg-slate-50">
                                <Plus className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">Añadir</span>
                                <input type="file" hidden multiple accept="image/*" onChange={handleImageUpload} />
                              </label>
                            )}
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 rounded-3xl aspect-video flex flex-col items-center justify-center text-slate-500 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-all bg-slate-50 hover:shadow-inner group">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-green-500" />
                          </div>
                          <span className="text-lg font-bold text-slate-700 group-hover:text-green-700">Sube fotos de tu cancha</span>
                          <span className="text-sm text-slate-500 mt-1">Haz clic o arrastra hasta 3 imágenes</span>
                          <input type="file" hidden multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                    
                    <form onSubmit={handleSaveField}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Nombre de la Cancha</Label>
                          <Input name="name" defaultValue={editingField?.name || ""} placeholder="Ej: Cancha Principal 1" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 text-lg" required />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Descripción</Label>
                          <Input name="description" defaultValue={editingField?.description || ""} placeholder="Detalles de la cancha, tipo de pasto, medidas..." className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Precio por Hora (S/)</Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">S/</span>
                            <Input name="pricePerHour" type="number" defaultValue={editingField?.pricePerHour || ""} placeholder="80" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-10 text-lg font-bold" required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Dirección</Label>
                          <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input name="address" defaultValue={editingField?.location?.address || ""} placeholder="Av. Los Pinos 123" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-12" required />
                          </div>
                        </div>
                        
                        {/* New Field Attributes */}
                        <div className="space-y-4 md:col-span-2 pt-4 border-t border-slate-100">
                          <h3 className="font-bold text-lg text-slate-900">Características de la Cancha</h3>
                          
                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Tipo de superficie</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Sintética", "Losa", "Grass natural", "Parquet (indoor)"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setSurfaceType(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${surfaceType === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Techo</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Techada", "Sin techo"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setRoofType(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${roofType === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Iluminación</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Con iluminación nocturna", "Sin iluminación"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setLighting(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${lighting === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Tamaño</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Fútbol 5", "Fútbol 7", "Fútbol 11"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setFieldSize(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${fieldSize === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Extras (Puedes elegir varios)</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Vestuarios", "Estacionamiento", "Cafetería / snacks", "Tribuna / graderías", "Baños", "WiFi"].map(extra => (
                                <button
                                  key={extra}
                                  type="button"
                                  onClick={() => {
                                    setExtras(prev => 
                                      prev.includes(extra) ? prev.filter(e => e !== extra) : [...prev, extra]
                                    )
                                  }}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${extras.includes(extra) ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {extra}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100 flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={() => setActiveView("fields")} className="h-12 px-8 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50">
                          Cancelar
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl text-base font-bold shadow-lg shadow-green-600/20"
                        >
                          {activeView === "new_field" ? "Crear Cancha" : "Guardar Cambios"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
