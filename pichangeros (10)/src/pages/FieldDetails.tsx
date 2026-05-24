import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Star, Calendar as CalendarIcon, Clock, CheckCircle2, ChevronLeft, CreditCard, Lock, Flag, Trophy, AlertCircle, Info } from "lucide-react";
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

const TIME_SLOTS = [
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00"
];

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
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [yapeCode, setYapeCode] = useState("");
  
  const [mapPosition, setMapPosition] = useState<[number, number]>([-12.046374, -77.042793]);

  const getSlotStatus = (date: Date, slot: string) => {
    if (!field) return 'closed';
    const dateStr = format(date, "yyyy-MM-dd");
    const scheduleData = field.scheduleData || {};
    const explicitStatus = scheduleData[dateStr]?.[slot];
    if (explicitStatus) return explicitStatus;
    
    // Check default hours
    const defaultOpenTime = field.defaultOpenTime || "08:00";
    const defaultCloseTime = field.defaultCloseTime || "22:00";
    const startHour = parseInt(slot.split(":")[0]);
    const openHour = parseInt(defaultOpenTime.split(":")[0]);
    const closeHour = parseInt(defaultCloseTime.split(":")[0]);
    
    let isWithinDefault = false;
    if (openHour <= closeHour) {
      isWithinDefault = startHour >= openHour && startHour < closeHour;
    } else {
      isWithinDefault = startHour >= openHour || startHour < closeHour;
    }
    
    return isWithinDefault ? 'open' : 'closed';
  };

  const handleSelectTime = (time: string, status: string) => {
    if (status === 'closed' || status === 'reserved') return; // Not clickable
    
    if (selectedTimes.includes(time)) {
      const clickedIdx = TIME_SLOTS.indexOf(time);
      const sortedSelectedIndices = selectedTimes
        .map(t => TIME_SLOTS.indexOf(t))
        .sort((a, b) => a - b);
      
      const minIdx = sortedSelectedIndices[0];
      const maxIdx = sortedSelectedIndices[sortedSelectedIndices.length - 1];
      
      if (clickedIdx === minIdx || clickedIdx === maxIdx) {
        setSelectedTimes(prev => prev.filter(t => t !== time));
      } else {
        setSelectedTimes([time]);
      }
    } else {
      if (selectedTimes.length === 0) {
        setSelectedTimes([time]);
      } else {
        const clickedIdx = TIME_SLOTS.indexOf(time);
        const sortedSelectedIndices = selectedTimes
          .map(t => TIME_SLOTS.indexOf(t))
          .sort((a, b) => a - b);
        
        const minIdx = sortedSelectedIndices[0];
        const maxIdx = sortedSelectedIndices[sortedSelectedIndices.length - 1];
        
        if (clickedIdx === minIdx - 1 || clickedIdx === maxIdx + 1) {
          const newSelection = [...selectedTimes, time].sort((a, b) => {
            return TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b);
          });
          setSelectedTimes(newSelection);
        } else {
          setSelectedTimes([time]);
        }
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
    
    if (!yapeCode || yapeCode.length < 6) {
      toast.error("Ingresa un código de operación Yape válido (al menos 6 dígitos)");
      return;
    }

    setBookingLoading(true);
    try {
      const securityCode = Math.floor(1000 + Math.random() * 9000).toString();
      const calculatedTotal = (field.pricePerHour || 0) * selectedTimes.length;
      
      const bookingData = {
        userId: user.uid,
        userName: profile?.displayName || user.email || "Usuario",
        fieldId: field.id,
        fieldName: field.name,
        ownerId: field.ownerId,
        date: format(selectedDate, "yyyy-MM-dd"),
        timeSlot: selectedTimes.join(", "),
        price: calculatedTotal,
        securityCode,
        status: "pending", // Waiting for payment verification
        estadoPago: "pendiente_verificacion",
        codigoOperacionYape: yapeCode,
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
        text: `Nueva reserva pendiente en ${field.name} para el ${format(selectedDate, "dd/MM/yyyy")} en el horario: ${selectedTimes.join(", ")}. Código de pago: ${yapeCode}. Código único de llegada: ${securityCode}. Pendiente de verificación por el administrador.`,
        createdAt: serverTimestamp()
      });
      
      toast.success(`¡Reserva enviada! Tu pago con código ${yapeCode} está siendo verificado.`, {
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
               <div className="h-72 md:h-96 rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-inner z-10">
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
                     S/ {(field.pricePerHour || 0) * (selectedTimes.length || 1)}
                     <span className="text-sm font-bold text-slate-400 opacity-60 ml-1 italic">
                       {selectedTimes.length > 0 ? `(${selectedTimes.length} h)` : "por hora"}
                     </span>
                   </p>
                </div>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">1. Selecciona el día</Label>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
                      {nextDays.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedDate(day);
                            setSelectedTimes([]); // Clear selected times on day change
                          }}
                          className={`flex flex-col items-center justify-center min-w-[70px] h-24 rounded-2xl transition-all border-2 ${
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

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">2. Selecciona tu horario</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {TIME_SLOTS.map((time, i) => {
                        const status = getSlotStatus(selectedDate, time); // 'open' | 'closed' | 'reserved'
                        const isSelected = selectedTimes.includes(time);
                        const isNotSelectable = status === 'closed' || status === 'reserved';
                        
                        return (
                          <button
                            key={i}
                            disabled={isNotSelectable}
                            onClick={() => handleSelectTime(time, status)}
                            className={`p-4 rounded-2xl text-sm font-bold tracking-tight transition-all border-2 flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? "bg-green-50 text-green-700 border-green-600 shadow-sm"
                                : isNotSelectable
                                  ? "bg-slate-100/70 text-slate-400 border-transparent cursor-not-allowed line-through"
                                  : "bg-slate-50 text-slate-700 border-transparent hover:border-slate-200 active:scale-95"
                            }`}
                          >
                            <span>{time}</span>
                            {status === 'reserved' && <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 no-underline leading-none">Reservado</span>}
                            {status === 'closed' && <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 no-underline leading-none">Cerrado</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between px-2">
                       <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total a pagar</span>
                       <span className="text-2xl font-black text-slate-900">S/ {(field.pricePerHour || 0) * selectedTimes.length}</span>
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
                          disabled={selectedTimes.length === 0}
                        >
                          Pagar con Yape
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                        <div className="bg-slate-950 p-6 flex items-center justify-between text-white">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-green-400" />
                            <span className="font-black tracking-tighter uppercase">Pichangeros</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Monto</p>
                            <p className="text-xl font-black text-green-400 leading-none mt-1">S/ {(field.pricePerHour || 0) * selectedTimes.length}</p>
                          </div>
                        </div>

                        <div className="p-8 space-y-6">
                          <div className="text-center space-y-4">
                            <p className="text-sm font-bold text-slate-600">Escanea el QR para pagar</p>
                            <div className="w-48 h-48 mx-auto bg-slate-100 rounded-3xl p-4 border-2 border-slate-50 shadow-inner flex items-center justify-center">
                              <img src="/yape-qr.png" alt="Yape QR" className="max-w-full max-h-full" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-900 uppercase">Instrucciones:</p>
                              <p className="text-xs text-slate-500">1. Abre Yape • 2. Escanea el QR • 3. Paga el monto exacto</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Código de operación</Label>
                            <Input 
                              placeholder="Ej: 2847361" 
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
