import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, Calendar as CalendarIcon, Clock, CheckCircle2, ChevronLeft, CreditCard, Lock, Flag, Trophy, AlertCircle, Info } from "lucide-react";
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { generateTimeSlots, timeToMinutes, formatSlot12h, generate30MinTimeOptions, getSlotsInRange, isSlotOverlappingBooking, formatTime12h, minutesToTime } from "@/lib/utils";

// Fix leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});



function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function FieldDetails() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [field, setField] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const TIME_SLOTS = useMemo(() => {
    return generateTimeSlots(
      field?.openTime || field?.defaultOpenTime,
      field?.closeTime || field?.defaultCloseTime
    );
  }, [field?.openTime, field?.defaultOpenTime, field?.closeTime, field?.defaultCloseTime]);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [fieldBookings, setFieldBookings] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [yapeCode, setYapeCode] = useState("");
  const randomPlaceholder = useMemo(() => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }, []);
  
  const [mapPosition, setMapPosition] = useState<[number, number]>([-12.046374, -77.042793]);

  useEffect(() => {
    if (!id) return;
    const qB = query(collection(db, "bookings"), where("fieldId", "==", id));
    const unsubB = onSnapshot(qB, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFieldBookings(list);
    }, (err) => console.error("Error fetching field bookings:", err));
    return () => unsubB();
  }, [id]);

  const getSlotStatus = (date: Date, slot: string) => {
    if (!field) return 'closed';
    const dateStr = format(date, "yyyy-MM-dd");
    const scheduleData = field.scheduleData || {};
    const explicitStatus = scheduleData[dateStr]?.[slot];
    if (explicitStatus) return explicitStatus;
    
    // Check if any booking overlaps this slot
    const isBooked = fieldBookings.some(b => {
      if (b.date !== dateStr) return false;
      if (b.status === "Cancelado" || b.status === "cancelled" || b.status === "Rechazado") return false;
      return isSlotOverlappingBooking(slot, b.timeSlot || b.time || "");
    });
    if (isBooked) return 'reserved';

    // Check default hours with minute precision
    const defaultOpenTime = field.openTime || field.defaultOpenTime || "08:00";
    const defaultCloseTime = field.closeTime || field.defaultCloseTime || "22:00";
    const slotStartTime = slot.split(" - ")[0] || slot;
    const slotMins = timeToMinutes(slotStartTime);
    const openMins = timeToMinutes(defaultOpenTime);
    let closeMins = timeToMinutes(defaultCloseTime);
    if (closeMins <= openMins) closeMins += 24 * 60;

    let isWithinDefault = false;
    if (slotMins >= openMins && slotMins < closeMins) {
      isWithinDefault = true;
    } else if (slotMins + 24 * 60 >= openMins && slotMins + 24 * 60 < closeMins) {
      isWithinDefault = true;
    }
    
    return isWithinDefault ? 'open' : 'closed';
  };

  const handleSelectTime = (time: string, status: string) => {
    if (status === 'closed' || status === 'reserved') return; // Not clickable
    
    const clickedIdx = TIME_SLOTS.indexOf(time);
    if (clickedIdx === -1) return;

    if (selectedTimes.length === 0) {
      // Minimum 1 hour = 2 x 30-min slots
      const nextSlot = TIME_SLOTS[clickedIdx + 1];
      if (nextSlot && getSlotStatus(selectedDate, nextSlot) === 'open') {
        setSelectedTimes([time, nextSlot]);
      } else {
        setSelectedTimes([time]);
      }
    } else {
      const sortedSelectedIndices = selectedTimes
        .map(t => TIME_SLOTS.indexOf(t))
        .sort((a, b) => a - b);
      
      const firstIdx = sortedSelectedIndices[0];
      const lastIdx = sortedSelectedIndices[sortedSelectedIndices.length - 1];

      if (clickedIdx === firstIdx && selectedTimes.length > 2) {
        // Deselect first slot
        setSelectedTimes(prev => prev.slice(1));
      } else if (clickedIdx === lastIdx && selectedTimes.length > 2) {
        // Deselect last slot
        setSelectedTimes(prev => prev.slice(0, -1));
      } else {
        // Range selection from firstIdx to clickedIdx
        const start = Math.min(firstIdx, clickedIdx);
        const end = Math.max(firstIdx, clickedIdx);
        const range = TIME_SLOTS.slice(start, end + 1);
        setSelectedTimes(range);
      }
    }
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const docRef = doc(db, "fields", id);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as any;
        setField(data);
        
        const lat = data.latitude || data.location?.lat;
        const lng = data.longitude || data.location?.lng;
        const address = data.address || data.location?.address;

        if (lat && lng) {
          setMapPosition([lat, lng]);
        } else if (address) {
          // Geocoding fallback
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Lima, Peru")}`);
            const results = await response.json();
            if (results && results.length > 0) {
              const resLat = parseFloat(results[0].lat);
              const resLon = parseFloat(results[0].lon);
              setMapPosition([resLat, resLon]);
            }
          } catch (e) {
            console.error("Geocoding error:", e);
          }
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to field details:", error);
      setLoading(false);
    });

    // Fetch reviews
    const qReviews = query(collection(db, "reviews"), where("fieldId", "==", id));
    getDocs(qReviews).then((querySnapshot) => {
      const fetchedReviews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(fetchedReviews);
    }).catch((e) => {
      console.error("Error fetching reviews:", e);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const savedFieldId = sessionStorage.getItem("redirect_booking_field_id");
    if (savedFieldId === id) {
      const savedDateStr = sessionStorage.getItem("redirect_booking_date");
      const savedTimesStr = sessionStorage.getItem("redirect_booking_times");
      if (savedDateStr) {
        setSelectedDate(new Date(savedDateStr + 'T00:00:00'));
      }
      if (savedTimesStr) {
        setSelectedTimes(savedTimesStr.split(",").filter(Boolean));
      }
      // Clear storage
      sessionStorage.removeItem("redirect_booking_field_id");
      sessionStorage.removeItem("redirect_booking_date");
      sessionStorage.removeItem("redirect_booking_times");
    }
  }, [id]);

  const handleOpenBookingModal = () => {
    if (!user) {
      toast.error("Debes iniciar sesión para reservar");
      // Save date and selected times in sessionStorage so login page can redirect and pick it up!
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const timesStr = selectedTimes.join(",");
      sessionStorage.setItem("redirect_booking_field_id", id || "");
      sessionStorage.setItem("redirect_booking_date", dateStr);
      sessionStorage.setItem("redirect_booking_times", timesStr);
      navigate("/login");
      return;
    }
    setIsBookingModalOpen(true);
  };

  const handleBooking = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para reservar");
      navigate("/login");
      return;
    }

    if (selectedTimes.length === 0) {
      toast.error("Selecciona un horario");
      return;
    }
    
    // Validation: Exactly 8 digits
    if (!yapeCode || !/^\d{8}$/.test(yapeCode.trim())) {
      toast.error("El número de operación debe tener exactamente 8 dígitos");
      return;
    }

    setBookingLoading(true);
    try {
      const securityCode = Math.floor(1000 + Math.random() * 9000).toString();
      const calculatedTotal = (field.pricePerHour || 0) * (selectedTimes.length * 0.5);
      const startRange = selectedTimes[0].split(" - ")[0];
      const endRange = selectedTimes[selectedTimes.length - 1].split(" - ")[1];
      const formattedSlot = `${startRange} - ${endRange}`;
      
      const bookingData = {
        userId: user.uid,
        userName: profile?.displayName || user.email || "Usuario",
        player: profile?.displayName || user.email || "Usuario",
        playerName: profile?.displayName || user.email || "Usuario",
        court: field.name,
        amount: calculatedTotal,
        time: formattedSlot,
        fieldId: field.id,
        fieldName: field.name,
        ownerId: field.ownerId,
        date: format(selectedDate, "yyyy-MM-dd"),
        timeSlot: formattedSlot,
        price: calculatedTotal,
        securityCode,
        codigoLlegada: securityCode,
        status: "En Verificación",
        estadoPago: "pendiente_verificacion",
        codigoOperacionYape: yapeCode.trim(),
        codigoYape: yapeCode.trim(),
        montoTotal: calculatedTotal,
        fechaPago: serverTimestamp(),
        paymentMethod: "yape",
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "bookings"), bookingData);
      
      // Update chat
      const chatId = `${user.uid}_${field.ownerId}`;
      await setDoc(doc(db, "chats", chatId), {
        participants: [user.uid, field.ownerId],
        updatedAt: serverTimestamp(),
        lastMessage: `Nueva reserva pendiente en ${field.name} (${yapeCode})`,
      }, { merge: true });

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: "system",
        text: `Nueva reserva pendiente en ${field.name} para el ${format(selectedDate, "dd/MM/yyyy")} en el horario: ${selectedTimes.join(", ")}. Número de operación: ${yapeCode.trim()}. Código único de llegada: ${securityCode}. Pendiente de verificación por el administrador.`,
        createdAt: serverTimestamp()
      });
      
      toast.success(`¡Reserva enviada! Tu pago con número de operación ${yapeCode.trim()} está siendo verificado.`, {
        duration: 10000
      });
      
      setSelectedTimes([]);
      setYapeCode("");
      setIsBookingModalOpen(false);
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
      
    } catch (error: any) {
      toast.error(error.message || "Error al procesar la reserva");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    if (!user) {
      toast.error("Debes iniciar sesión para reportar un comentario");
      return;
    }

    try {
      await addDoc(collection(db, "reports"), {
        type: "review",
        targetId: reviewId,
        reporterId: user.uid,
        reporterName: profile?.displayName || "Usuario",
        status: "pending",
        createdAt: serverTimestamp()
      });
      toast.success("Comentario reportado. Nuestros administradores lo revisarán.");
    } catch (error) {
      console.error("Error reporting review:", error);
      toast.error("Error al enviar el reporte");
    }
  };

  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!field) return <div className="min-h-screen flex items-center justify-center">Cancha no encontrada</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="relative h-72 sm:h-96 w-full overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 group">
          <img 
            src={field.photos?.[0] || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1200"} 
            alt={field.name} 
            className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 text-white">
          <div className="max-w-7xl mx-auto px-4">
            <Button 
                variant="ghost" 
                size="sm" 
                className="mb-4 text-white hover:bg-white/10 backdrop-blur-md rounded-full px-4 -ml-4"
                onClick={() => navigate(-1)}
            >
                <ChevronLeft className="w-5 h-5 mr-1" /> Volver
            </Button>
            <div className="flex flex-wrap items-center gap-2 mb-3">
               <Badge className="bg-green-500 text-white border-none rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20">Verificada</Badge>
               <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {field.rating?.toFixed(1) || "4.5"} ({reviews.length} reseñas)
               </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-none">{field.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-slate-300">
               <p className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 text-sm md:text-base">
                  <MapPin className="w-4 h-4 text-green-400" />
                  {field.location?.address}
               </p>
               <p className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 text-sm md:text-base">
                  <Flag className="w-4 h-4 text-green-400" />
                  {field.surfaceType || "Césped Sintético"}
               </p>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-2 space-y-8 md:space-y-12">
            <section className="space-y-4">
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Sobre esta cancha</h2>
               <p className="text-slate-600 text-lg leading-relaxed">{field.description}</p>
            </section>

            <section className="space-y-6">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest text-[10px] opacity-50">Características</h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Tamaño", value: field.fieldSize || "Fútbol 7", icon: Trophy },
                    { label: "Techo", value: field.roofType || "Techada", icon: CheckCircle2 },
                    { label: "Iluminación", value: field.lighting || "Profesional", icon: Star },
                    { label: "Canchas", value: `${field.numberOfCourts || 1} canchas`, icon: MapPin },
                  ].map((attr, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                       <attr.icon className="w-6 h-6 text-green-600 mb-3" />
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">{attr.label}</p>
                       <p className="text-sm font-black text-slate-900">{attr.value}</p>
                    </div>
                  ))}
               </div>
            </section>

            <section className="space-y-6">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest text-[10px] opacity-50">Ubicación exacta</h3>
               <div className="relative h-72 md:h-96 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-inner z-0">
                <MapContainer 
                  center={mapPosition} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <MapUpdater center={mapPosition} />
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={mapPosition} icon={greenIcon}>
                    <Popup>{field.name}</Popup>
                  </Marker>
                </MapContainer>
               </div>
            </section>

            <section className="space-y-8">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reseñas de la comunidad</h3>
                  <div className="text-right">
                     <p className="text-3xl font-black text-slate-900">{field.rating?.toFixed(1) || "4.5"}</p>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{reviews.length} reseñas</p>
                  </div>
               </div>
               
               <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-[2.5rem] border border-slate-100 italic text-slate-400">Aún no hay reseñas, ¡sé el primero en jugar aquí!</div>
                  ) : (
                    reviews.map((review) => (
                      <Card key={review.id} className="rounded-3xl border-none shadow-sm bg-white overflow-hidden p-6 md:p-8">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-lg">
                              {review.userName?.charAt(0) || "U"}
                            </div>
                            <div>
                               <p className="font-bold text-slate-900">{review.userName || "Jugador"}</p>
                               <div className="flex gap-0.5 mb-2">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200"}`} />
                                  ))}
                               </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-300 hover:text-red-500 rounded-xl"
                            onClick={() => handleReportReview(review.id)}
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-slate-600 mt-2">{review.comment}</p>
                      </Card>
                    ))
                  )}
               </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-28 space-y-6 pb-24 md:pb-0">
              <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-green-900/10 bg-white overflow-hidden p-0">
                <div className="bg-slate-950 p-8 text-white">
                   <p className="text-[10px] text-green-400 font-black uppercase tracking-[0.2em] mb-2 leading-none">
                     {selectedTimes.length > 0 ? "Monto Total" : "Precio por hora"}
                   </p>
                   <p className="text-5xl font-black">
                     S/ {selectedTimes.length > 0 ? ((field.pricePerHour || 0) * (selectedTimes.length * 0.5)).toFixed(2) : (field.pricePerHour || 0)}
                     <span className="text-sm font-bold text-slate-400 opacity-60 ml-1 italic">
                       {selectedTimes.length > 0 ? `(${selectedTimes.length * 0.5} ${selectedTimes.length === 2 ? 'hora' : 'horas'})` : "por hora"}
                     </span>
                   </p>
                </div>
                <CardContent className="p-8 space-y-8">
                  {/* 1. Selector de Días (7 días con scroll horizontal) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">1. Selecciona el día</Label>
                      <span className="text-[10px] font-bold text-slate-400">7 días disponibles</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 scroll-smooth touch-pan-x snap-x">
                      {nextDays.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedDate(day);
                            setSelectedTimes([]); // Clear selected times on day change
                          }}
                          className={`flex flex-col items-center justify-center min-w-[76px] h-24 rounded-2xl transition-all border-2 shrink-0 snap-start ${
                            format(selectedDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
                              ? "bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/20 scale-105 active:scale-100"
                              : "bg-slate-50 text-slate-900 border-transparent hover:border-slate-200 active:scale-95"
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">{format(day, "EEE", { locale: es })}</span>
                          <span className="text-xl font-black">{format(day, "d")}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Selecciona Horarios (30 min intervals) */}
                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">2. Selecciona tu horario (intervalos de 30 min)</Label>
                    
                    {/* Controles de Hora de Inicio y Hora de Fin */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Hora de inicio</span>
                        <Select
                          value={selectedTimes.length > 0 ? selectedTimes[0].split(" - ")[0] : ""}
                          onValueChange={(val) => {
                            const startMins = timeToMinutes(val);
                            // Default to +60 mins (1 hour min)
                            const endMins = startMins + 60;
                            const endVal = minutesToTime(endMins);
                            const range = getSlotsInRange(val, endVal);
                            setSelectedTimes(range);
                          }}
                        >
                          <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 text-xs font-bold">
                            <SelectValue placeholder="Desde" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 z-[1000]">
                            {TIME_SLOTS.map(s => {
                              const startTimeVal = s.split(" - ")[0];
                              const status = getSlotStatus(selectedDate, s);
                              return (
                                <SelectItem key={startTimeVal} value={startTimeVal} disabled={status === 'closed' || status === 'reserved'}>
                                  {formatTime12h(startTimeVal)} {status === 'reserved' ? '(Reservado)' : status === 'closed' ? '(Cerrado)' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Hora de fin</span>
                        <Select
                          value={selectedTimes.length > 0 ? selectedTimes[selectedTimes.length - 1].split(" - ")[1] : ""}
                          onValueChange={(val) => {
                            const startVal = selectedTimes.length > 0 ? selectedTimes[0].split(" - ")[0] : "08:00";
                            const range = getSlotsInRange(startVal, val);
                            setSelectedTimes(range);
                          }}
                        >
                          <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 text-xs font-bold">
                            <SelectValue placeholder="Hasta" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 z-[1000]">
                            {TIME_SLOTS.map(s => {
                              const endTimeVal = s.split(" - ")[1];
                              const startVal = selectedTimes.length > 0 ? selectedTimes[0].split(" - ")[0] : "08:00";
                              const isBeforeMinDuration = timeToMinutes(endTimeVal) < timeToMinutes(startVal) + 60;
                              return (
                                <SelectItem key={endTimeVal} value={endTimeVal} disabled={isBeforeMinDuration}>
                                  {formatTime12h(endTimeVal)}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Strip grid of 30-min slots */}
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                      {TIME_SLOTS.map((time, i) => {
                        const status = getSlotStatus(selectedDate, time); // 'open' | 'closed' | 'reserved'
                        const isSelected = selectedTimes.includes(time);
                        const isNotSelectable = status === 'closed' || status === 'reserved';
                        
                        return (
                          <button
                            key={i}
                            disabled={isNotSelectable}
                            onClick={() => handleSelectTime(time, status)}
                            className={`p-3 rounded-2xl text-xs font-bold tracking-tight transition-all border-2 flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-600/20"
                                : isNotSelectable
                                  ? "bg-slate-100/70 text-slate-400 border-transparent cursor-not-allowed line-through opacity-60"
                                  : "bg-slate-50 text-slate-700 border-transparent hover:border-slate-200 active:scale-95"
                            }`}
                          >
                            <span>{formatSlot12h(time)}</span>
                            {status === 'reserved' && <span className="text-[8px] font-black uppercase tracking-wider text-amber-500 no-underline leading-none">Reservado</span>}
                            {status === 'closed' && <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 no-underline leading-none">Cerrado</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resumen & Validaciones */}
                  <div className="space-y-4 pt-2">
                    {selectedTimes.length > 0 && selectedTimes.length < 2 && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-2 text-amber-800 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>La duración mínima obligatoria de reserva es de 1 hora (60 minutos).</span>
                      </div>
                    )}

                    {selectedTimes.some(slot => getSlotStatus(selectedDate, slot) !== 'open') && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-2xl flex items-center gap-2 text-red-800 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>El rango seleccionado incluye franjas cerradas o reservadas.</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-2">
                       <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total a pagar</span>
                       <span className="text-2xl font-black text-slate-900">
                         S/ {((field.pricePerHour || 0) * (selectedTimes.length * 0.5)).toFixed(2)}
                       </span>
                    </div>

                    {/* Aviso informativo de 3 pasos */}
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-3 shadow-xs">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-750 flex items-center gap-1.5 leading-none">
                        <Info className="w-4 h-4 text-green-600 shrink-0" />
                        ¿Cómo funciona tu reserva?
                      </h4>
                      <ol className="text-xs text-slate-600 space-y-2.5 list-none pl-0">
                        <li className="flex gap-2.5 items-start">
                          <span className="font-black text-green-700 bg-green-100/80 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">1</span>
                          <span><strong>Reserva y paga:</strong> Elige tus horarios y completa tu pago mediante Yape seguro.</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className="font-black text-green-700 bg-green-100/80 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">2</span>
                          <span><strong>Muestra tu código:</strong> Al llegar a la cancha, muestra tu código único de 4 dígitos al dueño.</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className="font-black text-green-700 bg-green-100/80 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">3</span>
                          <span><strong>Confirmación:</strong> El dueño ingresará el código para dar inicio y liberar el pago.</span>
                        </li>
                      </ol>
                    </div>
                    
                    <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          className="w-full h-16 bg-green-600 hover:bg-green-700 rounded-3xl text-lg font-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-green-600/20 border-none disabled:opacity-50"
                          onClick={handleOpenBookingModal}
                          disabled={selectedTimes.length < 2 || selectedTimes.some(slot => getSlotStatus(selectedDate, slot) !== 'open')}
                        >
                          Pagar con Yape
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden z-[1000]">
                        <div className="bg-slate-950 p-6 flex items-center justify-between text-white">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-green-400" />
                            <span className="font-black tracking-tighter uppercase">Pichangeros</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Monto</p>
                            <p className="text-xl font-black text-green-400 leading-none mt-1">S/ {((field.pricePerHour || 0) * (selectedTimes.length * 0.5)).toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="p-8 space-y-6">
                          <div className="text-center space-y-4">
                            <p className="text-sm font-bold text-slate-600">Escanea el QR para pagar</p>
                            <div className="w-52 h-52 mx-auto bg-white rounded-3xl p-4 border-2 border-purple-100 shadow-md flex flex-col items-center justify-center relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-purple-600 via-purple-500 to-emerald-500"></div>
                              <svg className="w-36 h-36 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm1 1h2v2H5V5zm9-3h8v8h-8V2zm2 2v4h4V4h-4zm1 1h2v2h-2V5zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm1 1h2v2H5v-2zm12-3h2v2h-2v-2zm3 0h2v3h-2v-3zm-5 3h2v2h-2v-2zm3 2h2v3h-2v-3zm2-2h2v2h-2v-2zm-7 3h2v2h-2v-2zm2 2h3v2h-3v-2zm3 0h3v2h-3v-2zm-5 2h2v2h-2v-2zm4 0h3v2h-3v-2z"/>
                              </svg>
                              <div className="mt-2 flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-xs">
                                <span>Pagar con Yape</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-900 uppercase">Instrucciones:</p>
                              <p className="text-xs text-slate-500">1. Abre Yape • 2. Escanea el QR • 3. Paga el monto exacto</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Número de operación</Label>
                            <Input 
                              placeholder={`Ej: ${randomPlaceholder}`} 
                              className="h-14 rounded-2xl border-2 border-slate-100 focus:border-green-500 transition-colors text-center text-lg font-black tracking-widest"
                              value={yapeCode}
                              onChange={(e) => setYapeCode(e.target.value)}
                            />
                            <div className="flex items-start gap-2 bg-yellow-50 p-3 rounded-2xl border border-yellow-100">
                               <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                               <p className="text-[10px] text-yellow-700 leading-tight">Tu reserva será confirmada una vez que verifiquemos el código de operación.</p>
                            </div>
                          </div>

                          <Button 
                            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-black shadow-xl transition-all active:scale-95 border-none mt-4" 
                            onClick={handleBooking}
                            disabled={bookingLoading}
                          >
                            {bookingLoading ? "Verificando..." : "Confirmar Pago"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest px-4 leading-relaxed">
                       Recibirás tu código de acceso una vez verificado el pago.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
