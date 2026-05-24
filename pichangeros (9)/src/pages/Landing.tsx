import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar, CreditCard, ShieldCheck, Star, Trophy, Users, Zap, Shield, Clock, Search, Navigation } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom green icon
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LIMA_DISTRICTS = [
  "Miraflores", "San Borja", "Surco", "San Isidro", "La Molina", 
  "Los Olivos", "San Miguel", "Magdalena", "Chorrillos", "Lurín",
  "San Juan de Lurigancho", "Ate", "Villa Maria del Triunfo", "Comas"
].sort();

export default function Landing() {
  const [fields, setFields] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const q = query(collection(db, "fields"), where("status", "==", "approved"));
        const querySnapshot = await getDocs(q);
        const fetchedFields = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFields(fetchedFields);
      } catch (error) {
        console.error("Error fetching fields for landing map:", error);
      }
    };
    fetchFields();
  }, []);

  const handleSearch = () => {
    if (selectedDistrict) {
      navigate(`/search?district=${selectedDistrict}`);
    } else {
      navigate("/search");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="absolute top-0 w-full z-50 bg-transparent">
        <div className="flex items-center justify-between p-4 md:p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white drop-shadow-md">Pichangeros</span>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <Link to="/login" className="text-xs md:text-sm font-medium text-white hover:text-green-300 drop-shadow-md">
              Iniciar Sesión
            </Link>
            <Link to="/register">
              <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full px-4 md:px-6 py-1 h-9 md:h-10 text-xs md:text-sm border-none transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20">
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-48 md:pb-32 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-900/20 via-slate-950 to-slate-950"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-2xl leading-tight">
            Tu cancha, <span className="text-green-400 font-black italic">cuando quieras</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-10 max-w-3xl mx-auto drop-shadow-md">
            Reserva las mejores canchas de Lima en segundos. Sin llamadas, sin vueltas, directo a la pichanga.
          </p>
          
          <div className="max-w-2xl mx-auto bg-white p-2 rounded-2xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-center gap-2 border-4 border-slate-900">
            <div className="flex-1 w-full relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
              <Select onValueChange={setSelectedDistrict}>
                <SelectTrigger className="w-full h-14 pl-12 rounded-full border-none bg-transparent focus:ring-0 text-lg font-medium">
                  <SelectValue placeholder="¿En qué distrito juegas?" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {LIMA_DISTRICTS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSearch}
              className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white rounded-full text-lg px-10 h-14 shadow-lg shadow-green-500/30 border-none transition-all hover:scale-105 active:scale-95 font-bold"
            >
              <Search className="w-5 h-5 mr-2" />
              Buscar canchas
            </Button>
          </div>
        </div>
      </section>

      {/* Map Section (Now second place) */}
      <section className="py-8 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative h-[400px] md:h-[600px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-900/50">
            <MapContainer center={[-12.0464, -77.0428]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              {fields.map(field => (
                field.location?.lat && field.location?.lng && (
                  <Marker 
                    key={field.id} 
                    position={[field.location.lat, field.location.lng]}
                    icon={customIcon}
                  >
                    <Popup className="rounded-xl overflow-hidden">
                      <div className="p-1 min-w-[200px]">
                        <img 
                          src={field.photos?.[0] || "https://picsum.photos/seed/cancha/300/200"} 
                          alt={field.name} 
                          className="w-full h-24 object-cover rounded-lg mb-2"
                        />
                        <h3 className="font-bold text-sm mb-1">{field.name}</h3>
                        <p className="text-xs text-slate-500 mb-2 truncate">{field.location.address}</p>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-green-600">S/ {field.pricePerHour}</span>
                          <Link to={`/field/${field.id}`}>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">Ver más</Button>
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
            
            {/* Floating Banner */}
            <div className="absolute top-6 left-6 z-[1000] bg-slate-900/80 backdrop-blur-md text-white p-4 rounded-3xl border border-white/10 hidden md:block max-w-xs shadow-2xl">
              <h4 className="font-bold mb-1 flex items-center gap-2 text-green-400">
                <Navigation className="w-4 h-4" />
                Cerca de ti
              </h4>
              <p className="text-xs text-slate-300">Explora el mapa y encuentra la pichanga perfecta en cualquier distrito de Lima.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits (Small cards at the bottom) */}
      <section className="py-16 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/50 border border-slate-800/50 p-6 rounded-3xl flex items-center gap-4 hover:border-green-500/30 transition-all">
              <div className="bg-green-500/10 p-3 rounded-2xl">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-0.5">Sin sorpresas</h3>
                <p className="text-xs text-slate-500">Disponibilidad real garantizada.</p>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 p-6 rounded-3xl flex items-center gap-4 hover:border-green-500/30 transition-all">
              <div className="bg-green-500/10 p-3 rounded-2xl">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-0.5">Reserva 24/7</h3>
                <p className="text-xs text-slate-500">Asegura tu cancha en segundos.</p>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 p-6 rounded-3xl flex items-center gap-4 hover:border-green-500/30 transition-all">
              <div className="bg-green-500/10 p-3 rounded-2xl">
                <Trophy className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-0.5">La Mejor Calidad</h3>
                <p className="text-xs text-slate-500">Canchas verificadas de Lima.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-slate-950 to-green-950/20 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight italic">¿Listo para el partido?</h2>
        <p className="text-slate-400 mb-10 max-w-2xl mx-auto text-xl">Únete a la mayor comunidad de peloteros de Lima y olvídate de las llamadas.</p>
        <Link to="/search">
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white rounded-full text-xl px-12 h-16 shadow-2xl shadow-green-500/40 border-none transition-all hover:scale-110 font-bold">
            Ir al mapa de canchas
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-500" />
            <span className="text-xl font-bold tracking-tight text-white font-mono uppercase">Pichangeros</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 Pichangeros • Lima, Perú.</p>
          <div className="flex gap-8">
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Términos</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center font-medium ${className}`}>
      {children}
    </span>
  );
}
