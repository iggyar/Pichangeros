import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Star, Calendar as CalendarIcon, Clock, CheckCircle2, ChevronLeft, CreditCard, Lock } from "lucide-react";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

// Mock data fallback
const MOCK_FIELD = {
  id: "1",
  name: "Canchas El Golazo",
  description: "Canchas de grass sintético de última generación. Contamos con iluminación LED, baños, duchas, estacionamiento y una pequeña cafetería. Ideal para pichangas de 7 vs 7.",
  pricePerHour: 80,
  location: { address: "Av. Javier Prado Este 123, San Borja", lat: -12.086, lng: -77.001 },
  photos: [
    "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518605368461-1e1e38ce8058?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1551280857-2b9bbe5204eb?q=80&w=600&auto=format&fit=crop"
  ],
  rating: 4.8,
  reviews: 124,
  ownerId: "owner123"
};

const TIME_SLOTS = [
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00"
];

export default function FieldDetails() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [field, setField] = useState<any>(MOCK_FIELD);
  const [loading, setLoading] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "yape" | "plin">("card");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  useEffect(() => {
    const fetchField = async () => {
      setLoading(true);
      try {
        if (id) {
          const docRef = doc(db, "fields", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setField({ id: docSnap.id, ...docSnap.data() });
          }
        }
      } catch (error) {
        console.error("Error fetching field:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchField();
  }, [id]);

  const handleOpenBookingModal = () => {
    if (!user) {
      toast.error("Debes iniciar sesión para reservar");
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

    if (!selectedTime) {
      toast.error("Selecciona un horario");
      return;
    }

    setBookingLoading(true);
    try {
      // Generate a random 6-digit code
      const securityCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const bookingData = {
        userId: user.uid,
        userName: profile?.displayName || user.email || "Usuario",
        fieldId: field.id,
        fieldName: field.name,
        ownerId: field.ownerId,
        date: format(selectedDate, "yyyy-MM-dd"),
        timeSlot: selectedTime,
        price: field.pricePerHour,
        securityCode,
        status: "active",
        paymentStatus: "paid",
        paymentMethod,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "bookings"), bookingData);
      
      toast.success(`¡Reserva confirmada! Tu código es: ${securityCode}`, {
        duration: 10000,
        action: {
          label: "Ver mis reservas",
          onClick: () => navigate("/dashboard")
        }
      });
      
      // Reset selection
      setSelectedTime(null);
      
      // In a real app, we would redirect to a success page or dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
      
    } catch (error: any) {
      toast.error(error.message || "Error al procesar la reserva");
    } finally {
      setBookingLoading(false);
    }
  };

  // Generate next 7 days
  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!field) return <div className="min-h-screen flex items-center justify-center">Cancha no encontrada</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <Link to="/search" className="flex items-center text-slate-600 hover:text-slate-900 transition-colors">
            <ChevronLeft className="w-5 h-5 mr-1" />
            Volver
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden h-[400px]">
              <img 
                src={field.photos[0]} 
                alt={field.name} 
                className="w-full h-full object-cover col-span-2 sm:col-span-1"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:grid grid-rows-2 gap-2 h-full">
                <img src={field.photos[1]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <img src={field.photos[2]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>

            {/* Info */}
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{field.name}</h1>
                  <p className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-5 h-5 text-green-600" />
                    {field.location.address}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-lg px-3 py-1">
                  <Star className="w-5 h-5 text-yellow-500 mr-1 fill-yellow-500" />
                  {field.rating}
                </Badge>
              </div>

              <div className="prose prose-slate max-w-none mt-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Descripción</h3>
                <p className="text-slate-600 leading-relaxed">{field.description}</p>
              </div>
            </div>

            {/* Map Section */}
            {field.location?.lat && field.location?.lng && (
              <div className="border-t border-slate-200 pt-8">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Ubicación</h3>
                <div className="h-[300px] rounded-2xl overflow-hidden border border-slate-200 z-0 relative">
                  <MapContainer 
                    center={[field.location.lat, field.location.lng]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    <Marker position={[field.location.lat, field.location.lng]} icon={greenIcon}>
                      <Popup>
                        <div className="font-bold">{field.name}</div>
                        <div className="text-xs text-slate-500">{field.location.address}</div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Reviews Placeholder */}
            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Reseñas ({field.reviews})</h3>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                    <div>
                      <p className="font-bold text-sm">Carlos M.</p>
                      <div className="flex text-yellow-500">
                        <Star className="w-3 h-3 fill-yellow-500" />
                        <Star className="w-3 h-3 fill-yellow-500" />
                        <Star className="w-3 h-3 fill-yellow-500" />
                        <Star className="w-3 h-3 fill-yellow-500" />
                        <Star className="w-3 h-3 fill-yellow-500" />
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm">Excelente cancha, el grass está en muy buen estado y la iluminación es perfecta para jugar de noche.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Booking Widget */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 border-slate-200 shadow-lg rounded-2xl overflow-hidden">
              <div className="bg-slate-900 text-white p-6">
                <div className="text-3xl font-bold">
                  S/ {field.pricePerHour} <span className="text-lg font-normal text-slate-400">/ hora</span>
                </div>
              </div>
              
              <CardContent className="p-6 space-y-6">
                {/* Date Selection */}
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-green-600" />
                    Selecciona una fecha
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                    {nextDays.map((date, i) => {
                      const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(date)}
                          className={`snap-start shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border transition-all ${
                            isSelected 
                              ? "bg-green-600 border-green-600 text-white shadow-md" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-green-600 hover:text-green-600"
                          }`}
                        >
                          <span className="text-xs uppercase font-medium">{format(date, "EEE", { locale: es })}</span>
                          <span className="text-xl font-bold">{format(date, "dd")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-600" />
                    Horarios disponibles
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                          selectedTime === time
                            ? "bg-green-50 border-green-600 text-green-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600"
                        }`}
                      >
                        <Clock className={`w-4 h-4 ${selectedTime === time ? "text-green-600" : "text-slate-400"}`} />
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Booking Dialog */}
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl h-14 text-lg font-bold shadow-lg shadow-green-500/30 transition-all"
                  disabled={!selectedTime}
                  onClick={handleOpenBookingModal}
                >
                  Reservar ahora
                </Button>

                <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">Confirmar Reserva</DialogTitle>
                      <DialogDescription>
                        Estás a un paso de asegurar tu pichanga.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cancha:</span>
                        <span className="font-bold text-slate-900">{field.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Fecha:</span>
                        <span className="font-bold text-slate-900">{format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Hora:</span>
                        <span className="font-bold text-slate-900">{selectedTime}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-slate-900 font-bold">Total a pagar:</span>
                        <span className="text-2xl font-bold text-green-600">S/ {field.pricePerHour}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-900 text-sm">Método de pago</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => setPaymentMethod("card")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border ${paymentMethod === "card" ? "border-green-600 bg-green-50 text-green-700" : "border-slate-200 text-slate-600"}`}
                        >
                          <CreditCard className="w-6 h-6 mb-1" />
                          <span className="text-xs font-bold">Tarjeta</span>
                        </button>
                        <button 
                          onClick={() => setPaymentMethod("yape")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border ${paymentMethod === "yape" ? "border-purple-600 bg-purple-50 text-purple-700" : "border-slate-200 text-slate-600"}`}
                        >
                          <div className="w-6 h-6 mb-1 font-bold text-lg leading-none">Y</div>
                          <span className="text-xs font-bold">Yape</span>
                        </button>
                        <button 
                          onClick={() => setPaymentMethod("plin")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border ${paymentMethod === "plin" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
                        >
                          <div className="w-6 h-6 mb-1 font-bold text-lg leading-none">P</div>
                          <span className="text-xs font-bold">Plin</span>
                        </button>
                      </div>
                    </div>

                    <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-col">
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg rounded-xl font-bold shadow-lg shadow-green-600/20" 
                        onClick={handleBooking}
                        disabled={bookingLoading}
                      >
                        {bookingLoading ? "Procesando pago..." : "Pagar y Confirmar"}
                      </Button>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 w-full mt-2">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Tu reserva está protegida. Pago seguro en la cancha.</span>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="flex items-start gap-2 text-sm text-slate-500 mt-4">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <p>Cancelación gratuita hasta 24 horas antes. Reembolso del 80% después.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
