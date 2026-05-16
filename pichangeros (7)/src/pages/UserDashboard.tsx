import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Calendar, Clock, MapPin, QrCode, ShieldAlert, Trophy, Star, ArrowLeftRight, Upload, CreditCard, Info, AlertTriangle, MessageSquare, Send, Users, Activity } from "lucide-react";
import { collection, query, where, getDocs, getDoc, orderBy, updateDoc, doc, addDoc, serverTimestamp, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
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
  const { user, profile, logout, loading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // Rating states
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedBookingToRate, setSelectedBookingToRate] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Payment methods states
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  // Messages states
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

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
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetchedBookings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sort in memory to avoid needing a composite index
        fetchedBookings.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return timeB - timeA;
        });

        setBookings(fetchedBookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "paymentMethods"),
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPaymentMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "paymentMethods");
    });
    
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort in memory
      fetchedChats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0;
        return timeB - timeA;
      });

      const chatsData = [];
      for (const data of fetchedChats) {
        const otherUserId = data.participants.find((id: string) => id !== user.uid);
        
        // Fetch other user's details
        let otherUserName = "Usuario";
        if (otherUserId) {
          try {
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) {
              otherUserName = userDoc.data().displayName || "Usuario";
            }
          } catch (error) {
            console.error("Error fetching chat user details:", error);
          }
        }
        
        chatsData.push({
          id: data.id,
          ...data,
          otherUserName
        });
      }
      setChats(chatsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });
    
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedChat) return;
    
    const q = query(
      collection(db, "chats", selectedChat.id, "messages"),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${selectedChat.id}/messages`);
    });
    
    return () => unsubscribe();
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user) return;
    
    const messageText = newMessage.trim();
    setNewMessage("");
    
    try {
      await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
        senderId: user.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "chats", selectedChat.id), {
        lastMessage: messageText,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar el mensaje");
    }
  };

  const activeBookings = bookings.filter(b => b.status === "active");
  const pastBookings = bookings.filter(b => b.status === "completed" || b.status === "cancelled");

  const navigate = useNavigate();

  const switchRole = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // If user is admin, don't change role, just navigate
      if (profile?.role === "admin") {
        navigate("/owner");
        return;
      }

      if (profile?.role !== "owner") {
        await setDoc(doc(db, "users", user.uid), { 
          role: "owner",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      toast.success("Cambiando a vista de Dueño...");
      navigate("/owner");
    } catch (error) {
      console.error("Error switching role:", error);
      toast.error("Error al cambiar de vista");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    
    try {
      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        status: "cancelled",
        updatedAt: serverTimestamp()
      });
      
      toast.success("Reserva cancelada correctamente. El reembolso del 80% está en proceso.");
      setIsCancelModalOpen(false);
      setSelectedBooking(null);
      
      // Update local state is not needed if we use onSnapshot, but since it's getDocs here:
      setBookings(prev => prev.map(b => 
        b.id === selectedBooking.id ? { ...b, status: "cancelled" } : b
      ));
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Error al cancelar la reserva");
    }
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

  const handleSupportSubmit = async () => {
    if (!user || !supportTopic || !supportMessage) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    
    setIsSubmittingSupport(true);
    try {
      await addDoc(collection(db, "support_tickets"), {
        userId: user.uid,
        userEmail: user.email,
        userName: profile?.displayName || "Usuario",
        userRole: profile?.role || "user",
        topic: supportTopic,
        message: supportMessage,
        status: "open",
        createdAt: serverTimestamp()
      });
      
      toast.success("Mensaje enviado a soporte. Te contactaremos pronto.");
      setIsSupportModalOpen(false);
      setSupportTopic("");
      setSupportMessage("");
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      toast.error("Error al enviar el mensaje");
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const handleRatingSubmit = async () => {
    if (!user || !selectedBookingToRate || ratingValue === 0) {
      toast.error("Por favor selecciona una calificación");
      return;
    }

    setIsSubmittingRating(true);
    try {
      await addDoc(collection(db, "reviews"), {
        userId: user.uid,
        userName: profile?.displayName || "Usuario",
        fieldId: selectedBookingToRate.fieldId || 'mock-id',
        bookingId: selectedBookingToRate.id,
        rating: ratingValue,
        comment: ratingComment,
        createdAt: serverTimestamp()
      });
      
      toast.success("¡Gracias por tu reseña!");
      setIsRatingModalOpen(false);
      setSelectedBookingToRate(null);
      setRatingValue(0);
      setRatingComment("");
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Error al enviar la reseña");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleAddCard = async () => {
    if (!user || !cardName || !cardNumber || !cardExpiry || !cardCvv) {
      toast.error("Por favor completa todos los campos de la tarjeta");
      return;
    }

    if (cardNumber.length < 16) {
      toast.error("Número de tarjeta inválido");
      return;
    }

    setIsSubmittingCard(true);
    try {
      // Simulate tokenization
      const last4 = cardNumber.slice(-4);
      const brand = cardNumber.startsWith("4") ? "Visa" : "Mastercard";
      
      await addDoc(collection(db, "paymentMethods"), {
        userId: user.uid,
        userName: cardName,
        last4,
        brand,
        expiry: cardExpiry,
        createdAt: serverTimestamp(),
        isDefault: paymentMethods.length === 0
      });
      
      toast.success("Tarjeta añadida correctamente");
      setIsAddCardModalOpen(false);
      setCardName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
    } catch (error) {
      console.error("Error adding card:", error);
      toast.error("Error al añadir la tarjeta");
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    try {
      await updateDoc(doc(db, "paymentMethods", cardId), {
        deleted: true // or just delete the doc, but flagging is often safer if we want to keep history
      });
      // For this demo I'll just use a direct delete if security rules allow, 
      // but standard delete is fine.
      // await deleteDoc(doc(db, "paymentMethods", cardId));
      toast.success("Tarjeta eliminada");
    } catch (error) {
      toast.error("Error al eliminar la tarjeta");
    }
  };

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setLoading(false);
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

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
            <Button variant="ghost" size="icon" onClick={() => logout()} className="text-slate-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar - Improved for mobile with horizontal scroll or better stacking */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
              <div className="bg-slate-950 p-6 md:p-8 text-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none"></div>
                <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold overflow-hidden ring-4 ring-slate-800/50 relative z-10">
                  {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "J"}
                </div>
                <h2 className="font-bold text-lg relative z-10">{profile?.displayName || "Jugador"}</h2>
                <p className="text-slate-400 text-sm relative z-10 truncate">{profile?.email}</p>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-1 gap-1">
                {[
                  { id: "bookings", label: "Mis Reservas", icon: Calendar },
                  { id: "profile", label: "Mi Perfil", icon: Users },
                  { id: "payments", label: "Pagos", icon: CreditCard },
                  { id: "messages", label: "Mensajes", icon: MessageSquare },
                  { id: "support", label: "Soporte", icon: Info },
                ].map((item) => (
                  <Button 
                    key={item.id}
                    variant="ghost" 
                    onClick={() => setActiveView(item.id)}
                    className={`justify-start rounded-xl h-12 md:h-14 px-4 transition-all ${activeView === item.id ? "text-green-700 bg-green-50 font-bold shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? "text-green-600" : "text-slate-400"}`} />
                    <span className="truncate">{item.label}</span>
                  </Button>
                ))}
                
                <div className="col-span-2 md:col-span-1 my-2 md:my-4 border-t border-slate-100"></div>
                
                <Button 
                  variant="outline" 
                  onClick={switchRole}
                  className="col-span-2 md:col-span-1 justify-start rounded-xl h-12 md:h-14 border-green-200 text-green-700 hover:bg-green-50 bg-green-50/30 font-medium"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-3" />
                  Modo Dueño
                </Button>

                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/admin")}
                    className="col-span-2 md:col-span-1 justify-start rounded-xl h-12 md:h-14 border-blue-200 text-blue-700 hover:bg-blue-50 mt-1 md:mt-2 bg-blue-50/30"
                  >
                    <ShieldAlert className="w-4 h-4 mr-3" />
                    Vista Admin
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6 md:space-y-8">
            {activeView === "bookings" && (
              <div className="space-y-6 md:space-y-8">
                {/* Prominent Search Banner */}
                <Card className="bg-gradient-to-br from-green-600 via-green-600 to-green-700 border-none shadow-2xl shadow-green-900/20 rounded-[2.5rem] overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-transform group-hover:scale-110 duration-700"></div>
                  <CardContent className="p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10 text-center md:text-left">
                    <div className="text-white">
                      <h2 className="text-3xl md:text-4xl font-black mb-3 leading-tight tracking-tight">¿Listo para la próxima pichanga?</h2>
                      <p className="text-green-100 text-lg md:text-xl max-w-md font-medium opacity-90">Encuentra las mejores canchas cerca de ti y reserva al instante.</p>
                    </div>
                    <Link to="/search" className="w-full sm:w-auto shrink-0">
                      <Button size="lg" className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 rounded-2xl text-lg px-10 h-16 shadow-xl border-none font-extrabold transition-all hover:scale-105 active:scale-95">
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
                  
                  <TabsContent value="active" className="space-y-4 md:space-y-6">
                    {activeBookings.length === 0 ? (
                      <div className="text-center py-12 md:py-20 bg-white rounded-3xl border-2 border-slate-100 border-dashed">
                        <Calendar className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mx-auto mb-4 md:mb-6" />
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">No tienes reservas próximas</h3>
                        <p className="text-slate-500 mb-6 md:mb-8 text-sm md:text-base">¡Es hora de armar la pichanga!</p>
                        <Link to="/search">
                          <Button className="bg-green-600 hover:bg-green-700 rounded-full h-12 px-8 font-bold shadow-lg shadow-green-600/20 transition-all border-none">Buscar canchas</Button>
                        </Link>
                      </div>
                    ) : (
                      activeBookings.map(booking => (
                        <Card key={booking.id} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                          <div className="flex flex-col md:flex-row">
                            <div className="bg-slate-950 text-white p-6 flex flex-col items-center justify-center md:w-52 shrink-0 relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-green-500/20 to-transparent pointer-events-none"></div>
                              <div className="bg-white p-3 rounded-2xl mb-4 relative z-10 shadow-xl">
                                <QRCode value={booking.checkInCode || booking.securityCode} size={90} level="H" />
                              </div>
                              <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 mb-1 text-center relative z-10">Acceso</span>
                              <span className="text-3xl font-black tracking-widest relative z-10 text-green-400">{booking.checkInCode || booking.securityCode}</span>
                            </div>
                            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                                  <div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">{booking.fieldName}</h3>
                                    <p className="text-slate-500 text-sm flex items-center gap-1.5">
                                      <MapPin className="w-4 h-4 text-slate-400" /> {booking.location || "Lima, Perú"}
                                    </p>
                                  </div>
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none rounded-lg px-3 py-1 font-bold text-xs uppercase tracking-wider">Confirmada</Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8 mt-2">
                                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                                    <div className="bg-white p-2 rounded-xl shadow-sm">
                                      <Calendar className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Fecha</span>
                                      <span className="text-sm font-bold text-slate-700">{formatDate(booking.date)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                                    <div className="bg-white p-2 rounded-xl shadow-sm">
                                      <Clock className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Horario</span>
                                      <span className="text-sm font-bold text-slate-700">{booking.timeSlot}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                                <Button 
                                  variant="outline" 
                                  className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl h-11 font-bold"
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsDetailsModalOpen(true);
                                  }}
                                >
                                  Detalles de reserva
                                </Button>
                                <Button 
                                  variant="outline"
                                  className="flex-1 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl h-11 font-bold"
                                  onClick={() => {
                                    setSelectedBooking(booking);
                                    setIsCancelModalOpen(true);
                                  }}
                                >
                                  Cancelar reserva
                                </Button>
                                <Button
                                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 font-bold"
                                  onClick={() => {
                                    setActiveView("messages");
                                    // In a real app we would navigate to the specific chat
                                  }}
                                >
                                  Contactar dueño
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="past" className="space-y-4 md:space-y-6">
                    {pastBookings.length === 0 ? (
                      <div className="text-center py-12 md:py-20 bg-white rounded-3xl border-2 border-slate-100 border-dashed">
                        <Clock className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400">No hay reservas pasadas</h3>
                      </div>
                    ) : (
                      pastBookings.map(booking => (
                        <Card key={booking.id} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white/60 hover:bg-white transition-all group">
                          <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                               <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                                  <Trophy className={`w-6 h-6 ${booking.status === 'completed' ? 'text-green-500' : 'text-slate-300'}`} />
                               </div>
                               <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{booking.fieldName}</h3>
                                    <Badge variant="outline" className={`border-none rounded-lg font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 ${booking.status === "completed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"}`}>
                                      {booking.status === "completed" ? "Completada" : "Cancelada"}
                                    </Badge>
                                  </div>
                                  <p className="text-slate-500 text-sm flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" /> {formatDate(booking.date)} • <Clock className="w-3.5 h-3.5" /> {booking.timeSlot}
                                  </p>
                               </div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                              {booking.status === "completed" && (
                                <Button 
                                  variant="outline" 
                                  className="flex-1 md:flex-none border-yellow-200 text-yellow-700 hover:bg-yellow-50 rounded-xl h-11 font-bold"
                                  onClick={() => {
                                    setSelectedBookingToRate(booking);
                                    setIsRatingModalOpen(true);
                                  }}
                                >
                                  <Star className="w-4 h-4 mr-2 fill-yellow-400 text-yellow-400" />
                                  Calificar
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                className="flex-1 md:flex-none border-slate-200 text-slate-600 rounded-xl h-11 font-bold hover:bg-slate-50"
                                onClick={() => navigate(`/field/${booking.fieldId || 'mock-id'}`)}
                              >
                                Reservar de nuevo
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
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
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Mis Pagos</h2>
                </div>
                
                <Card className="border-slate-200 shadow-sm rounded-2xl bg-amber-50 border-amber-200">
                  <CardContent className="p-6 flex items-start gap-4">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-amber-900">Información sobre pagos</h3>
                      <p className="text-sm text-amber-800">
                        Actualmente solo aceptamos **Yape** como método de pago. 
                        Todos tus pagos realizados se listan a continuación. Si tienes algún problema con una verificación, por favor contacta a soporte.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900">Historial de Pagos Yape</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold">Fecha</th>
                          <th className="px-6 py-4 font-bold">Cancha</th>
                          <th className="px-6 py-4 font-bold">Monto</th>
                          <th className="px-6 py-4 font-bold">Cód. Yape</th>
                          <th className="px-6 py-4 font-bold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings
                          .filter(b => b.paymentMethod === 'yape')
                          .map((booking) => (
                            <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 text-slate-600">{booking.date}</td>
                              <td className="px-6 py-4 font-medium text-slate-900">{booking.fieldName}</td>
                              <td className="px-6 py-4 font-bold text-slate-900">S/ {(booking.price || booking.montoTotal || 0).toFixed(2)}</td>
                              <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">{booking.codigoOperacionYape}</td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className={`
                                  ${booking.estadoPago === 'Pago confirmado' ? 'border-green-200 text-green-700 bg-green-50' : ''}
                                  ${booking.estadoPago === 'pendiente_verificacion' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' : ''}
                                  ${booking.estadoPago === 'Rechazado' ? 'border-red-200 text-red-700 bg-red-50' : ''}
                                  ${!booking.estadoPago || booking.estadoPago === 'Pendiente de pago' ? 'border-slate-200 text-slate-700 bg-slate-50' : ''}
                                `}>
                                  {booking.estadoPago === 'pendiente_verificacion' ? 'En Verificación' : (booking.estadoPago || "Pendiente")}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        }
                        {bookings.filter(b => b.paymentMethod === 'yape').length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium font-sans">
                              No tienes pagos registrados aún.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeView === "messages" && (
              <div className="h-[calc(100vh-12rem)]">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Mensajes</h2>
                <Card className="border-slate-200 shadow-sm h-full flex overflow-hidden">
                  {/* Chat List */}
                  <div className={`w-full md:w-1/3 border-r border-slate-200 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-bold text-slate-900">Tus Conversaciones</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {chats.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No tienes mensajes aún</p>
                        </div>
                      ) : (
                        chats.map(chat => (
                          <div 
                            key={chat.id}
                            onClick={() => setSelectedChat(chat)}
                            className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedChat?.id === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-slate-900 truncate pr-2">{chat.otherUserName}</h4>
                            </div>
                            <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Chat Area */}
                  <div className={`w-full md:w-2/3 flex flex-col bg-slate-50/50 ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    {selectedChat ? (
                      <>
                        <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedChat(null)}>
                            <ArrowLeftRight className="w-5 h-5" />
                          </Button>
                          <h3 className="font-bold text-slate-900">{selectedChat.otherUserName}</h3>
                        </div>
                        <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p><strong>Aviso:</strong> Por favor, comunícate con respeto. El incumplimiento de nuestras normas de convivencia puede resultar en la suspensión de tu cuenta.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {chatMessages.map(msg => {
                            const isMe = msg.senderId === user?.uid;
                            const isSystem = msg.senderId === "system";
                            return (
                              <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                  isSystem ? 'bg-slate-200 text-slate-600 text-xs font-medium' :
                                  isMe ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                                }`}>
                                  {msg.text}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="p-4 bg-white border-t border-slate-200">
                          <form onSubmit={handleSendMessage} className="flex gap-2">
                            <Input 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Escribe un mensaje..."
                              className="flex-1 rounded-full bg-slate-50"
                            />
                            <Button type="submit" size="icon" className="rounded-full bg-green-600 hover:bg-green-700 shrink-0">
                              <Send className="w-4 h-4" />
                            </Button>
                          </form>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-600 mb-1">Tus Mensajes</h3>
                        <p className="text-sm">Selecciona una conversación para empezar a chatear con los dueños de las canchas.</p>
                      </div>
                    )}
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
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsSupportModalOpen(true)}>Contactar Soporte</Button>
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
      {/* Support Modal */}
      <Dialog open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-green-600" />
              Contactar Soporte
            </DialogTitle>
            <DialogDescription>
              Envíanos un mensaje y te responderemos lo antes posible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>¿En qué podemos ayudarte?</Label>
              <Select value={supportTopic} onValueChange={setSupportTopic}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Problema con una reserva">Problema con una reserva</SelectItem>
                  <SelectItem value="Problema con un pago">Problema con un pago</SelectItem>
                  <SelectItem value="Reportar un usuario/cancha">Reportar un usuario/cancha</SelectItem>
                  <SelectItem value="Problema técnico">Problema técnico</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Detalles de tu consulta</Label>
              <textarea 
                className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Explica tu problema detalladamente..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
              ></textarea>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" className="w-full sm:w-1/2 rounded-xl" onClick={() => setIsSupportModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="w-full sm:w-1/2 rounded-xl bg-green-600 hover:bg-green-700" 
              onClick={handleSupportSubmit}
              disabled={isSubmittingSupport}
            >
              {isSubmittingSupport ? "Enviando..." : "Enviar Mensaje"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Rating Modal */}
      <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Calificar Cancha
            </DialogTitle>
            <DialogDescription>
              ¿Qué tal estuvo tu experiencia en {selectedBookingToRate?.fieldName}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className={`p-2 transition-colors ${ratingValue >= star ? 'text-yellow-500' : 'text-slate-200 hover:text-yellow-200'}`}
                >
                  <Star className="w-10 h-10 fill-current" />
                </button>
              ))}
            </div>
            
            <div className="space-y-2">
              <Label>Comentario (Opcional)</Label>
              <textarea 
                className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Cuéntanos más sobre tu experiencia..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              ></textarea>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" className="w-full sm:w-1/2 rounded-xl" onClick={() => setIsRatingModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="w-full sm:w-1/2 rounded-xl bg-green-600 hover:bg-green-700" 
              onClick={handleRatingSubmit}
              disabled={isSubmittingRating || ratingValue === 0}
            >
              {isSubmittingRating ? "Enviando..." : "Publicar Reseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Card Modal */}
      <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Añadir Tarjeta</DialogTitle>
            <DialogDescription>
              Tus datos están protegidos por encriptación de grado bancario.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre en la tarjeta</Label>
              <Input 
                placeholder="Como aparece en el plástico" 
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="rounded-xl border-slate-200 h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Número de tarjeta</Label>
              <Input 
                placeholder="0000 0000 0000 0000" 
                maxLength={16}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                className="rounded-xl border-slate-200 h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input 
                  placeholder="MM/AA" 
                  maxLength={5}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="rounded-xl border-slate-200 h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>CVV</Label>
                <Input 
                  placeholder="123" 
                  maxLength={3}
                  type="password"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl border-slate-200 h-12"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <ShieldAlert className="w-4 h-4 text-green-600" />
              <span>Nunca guardamos tu CVV. Las transacciones son procesadas de forma segura.</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" className="w-full sm:w-1/2 rounded-xl" onClick={() => setIsAddCardModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="w-full sm:w-1/2 rounded-xl bg-green-600 hover:bg-green-700" 
              onClick={handleAddCard}
              disabled={isSubmittingCard}
            >
              {isSubmittingCard ? "Guardando..." : "Guardar Tarjeta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
