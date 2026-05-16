import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search as SearchIcon, Star, Filter, Trophy, Navigation, Clock } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Component to handle map centering
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function Search() {
  const { user, profile } = useAuth();
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedCourt, setHighlightedCourt] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  
  // Filters state
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [surfaceType, setSurfaceType] = useState("all");
  const [district, setDistrict] = useState(searchParams.get("district") || "all");
  const navigate = useNavigate();
  
  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([-12.0464, -77.0428]); // Default: Lima
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true);
      try {
        const path = "fields";
        const q = query(collection(db, path), where("status", "==", "approved"));
        const querySnapshot = await getDocs(q);
        const fetchedFields = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFields(fetchedFields);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "fields");
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, []);

  const locateUser = () => {
    if (navigator.geolocation) {
      toast.info("Buscando tu ubicación...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setMapZoom(14);
          toast.success("Ubicación encontrada");
        },
        () => {
          toast.error("No se pudo obtener tu ubicación. Verifica los permisos de tu navegador.");
        }
      );
    } else {
      toast.error("Tu navegador no soporta geolocalización");
    }
  };

  const filteredFields = fields.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (f.location?.address || "").toLowerCase().includes(searchTerm.toLowerCase());
    const fieldPrice = f.pricePerHour || f.price || 0;
    const matchesMinPrice = minPrice === "" || fieldPrice >= parseInt(minPrice);
    const matchesMaxPrice = maxPrice === "" || fieldPrice <= parseInt(maxPrice);
    const matchesSurface = surfaceType === "all" || f.surfaceType === surfaceType || f.type === surfaceType;
    
    // Improved district matching
    const fieldDistrict = f.district || f.location?.district || "";
    const matchesDistrict = district === "all" || 
                           fieldDistrict.toLowerCase() === district.toLowerCase() ||
                           (f.location?.address || "").toLowerCase().includes(district.toLowerCase());
    
    return matchesSearch && matchesMinPrice && matchesMaxPrice && matchesSurface && matchesDistrict;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Trophy className="w-6 h-6 md:w-7 md:h-7 text-green-600" />
            <span className="text-xl md:text-2xl font-bold tracking-tighter text-slate-950 hidden xs:block">Pichangeros</span>
          </Link>
          
          <div className="flex-1 max-w-2xl relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
            <Input 
              placeholder="Buscar por distrito o nombre..." 
              className="pl-10 md:pl-12 bg-slate-100 border-none focus-visible:ring-2 focus-visible:ring-green-600/20 focus-visible:bg-white rounded-2xl h-10 md:h-12 w-full transition-all text-sm md:text-base shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/dashboard">
              <Button variant="ghost" className="text-slate-600 hover:text-green-600 rounded-xl px-2 md:px-4">
                <span className="hidden md:inline">Volver</span>
                <Navigation className="w-5 h-5 md:hidden" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Mobile Quick Filters - Floating on scroll or at top */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto p-4 bg-white border-b border-slate-100 no-scrollbar sticky top-0 z-20">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full shrink-0 border-slate-200">
                <Filter className="w-4 h-4 mr-1.5" />
                Filtros
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-t-[2rem] sm:rounded-2xl bottom-0 sm:bottom-auto top-auto sm:top-1/2 translate-y-0 sm:-translate-y-1/2">
              <DialogHeader>
                <DialogTitle>Filtros</DialogTitle>
                <DialogDescription>Ajusta tu búsqueda para encontrar la cancha ideal.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-900">Precio por hora (S/)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" placeholder="Mín" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="rounded-xl" />
                    <span className="text-slate-400">a</span>
                    <Input type="number" placeholder="Máx" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-900">Tipo de superficie</Label>
                  <Select value={surfaceType} onValueChange={setSurfaceType}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Cualquiera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Cualquiera</SelectItem>
                      <SelectItem value="Sintética">Sintética</SelectItem>
                      <SelectItem value="Losa">Losa</SelectItem>
                      <SelectItem value="Grass natural">Grass natural</SelectItem>
                      <SelectItem value="Parquet (indoor)">Parquet (indoor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-900">Distrito</Label>
                  <Select value={district} onValueChange={setDistrict}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Miraflores">Miraflores</SelectItem>
                      <SelectItem value="San Borja">San Borja</SelectItem>
                      <SelectItem value="Surco">Surco</SelectItem>
                      <SelectItem value="San Isidro">San Isidro</SelectItem>
                      <SelectItem value="La Molina">La Molina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={locateUser} className="rounded-full shrink-0 border-green-200 text-green-700 bg-green-50/50">
            <Navigation className="w-4 h-4 mr-1.5 transition-transform" />
            Cerca de mí
          </Button>

          {["Sintética", "Miraflores", "Surco"].map((pill) => (
             <Button key={pill} variant="ghost" size="sm" className="rounded-full shrink-0 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors" onClick={() => setSearchTerm(pill)}>
               {pill}
             </Button>
          ))}
        </div>

        {/* List View */}
        <div className="w-full md:w-1/2 lg:w-2/5 p-4 md:p-6 overflow-y-auto h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] scrollbar-hide">
          <div className="flex justify-between items-center mb-6 hidden md:flex">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{filteredFields.length} canchas encontradas</h2>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-slate-600 border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filtros</DialogTitle>
                    <DialogDescription>Ajusta tu búsqueda para encontrar la cancha ideal.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-bold">Precio por hora (S/)</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" placeholder="Mín" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="rounded-xl" />
                        <span className="text-slate-400">a</span>
                        <Input type="number" placeholder="Máx" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-bold">Tipo de superficie</Label>
                      <Select value={surfaceType} onValueChange={setSurfaceType}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Cualquiera" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="Sintética">Sintética</SelectItem>
                          <SelectItem value="Losa">Losa</SelectItem>
                          <SelectItem value="Grass natural">Grass natural</SelectItem>
                          <SelectItem value="Parquet (indoor)">Parquet (indoor)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-bold">Distrito</Label>
                      <Select value={district} onValueChange={setDistrict}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="Miraflores">Miraflores</SelectItem>
                          <SelectItem value="San Borja">San Borja</SelectItem>
                          <SelectItem value="Surco">Surco</SelectItem>
                          <SelectItem value="San Isidro">San Isidro</SelectItem>
                          <SelectItem value="La Molina">La Molina</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={locateUser} className="text-green-600 border-green-200 rounded-xl hover:bg-green-50 transition-colors">
                <Navigation className="w-4 h-4 mr-2" />
                Cerca de mí
              </Button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
               <Trophy className="w-12 h-12 text-slate-200 mb-4" />
               <p className="text-slate-400 font-medium">Buscando las mejores canchas...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredFields.map(field => (
                <div 
                  key={field.id} 
                  id={`court-${field.id}`} 
                  className="block group cursor-pointer"
                  onClick={() => {
                    if (!profile) {
                      toast.info("Debes iniciar sesión para ver más detalles o reservar.");
                      navigate("/login");
                    } else {
                      navigate(`/field/${field.id}`);
                    }
                  }}
                >
                  <Card className={`overflow-hidden transition-all duration-300 shadow-sm border-none bg-white hover:shadow-xl hover:-translate-y-1 relative ${highlightedCourt === field.id ? 'ring-2 ring-green-600' : ''}`}>
                    <div className="flex flex-col sm:flex-row h-full relative">
                      <div className="w-full sm:w-[38%] h-52 sm:h-auto relative overflow-hidden shrink-0">
                        <img 
                          src={field.photos[0] || "https://picsum.photos/seed/cancha/600/400"} 
                          alt={field.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:hidden"></div>
                        <Badge className="absolute top-3 left-3 bg-white/95 text-slate-900 border-none px-2 py-1 flex items-center gap-1 shadow-md">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold text-xs">{field.rating ? field.rating.toFixed(1) : "Nuevo"}</span>
                        </Badge>
                      </div>
                      <div className="w-full sm:w-[62%] p-5 md:p-6 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                             <h3 className="font-extrabold text-lg md:text-xl text-slate-900 group-hover:text-green-600 transition-colors line-clamp-1 tracking-tight">
                               {field.name}
                             </h3>
                          </div>
                          <p className="text-slate-500 text-sm flex items-start gap-1.5 mb-4 line-clamp-1">
                            <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                            {field.location.address}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                              {field.type || "Fútbol"}
                            </Badge>
                            {(field.openTime || field.closeTime) && (
                              <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50 border-none rounded-lg px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                                <Clock className="w-3.5 h-3.5" />
                                {field.openTime || "08:00"} - {field.closeTime || "22:00"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Desde</span>
                             <div className="text-xl md:text-2xl font-black text-slate-900 leading-none">
                               S/ {field.pricePerHour || field.price} <span className="text-xs font-medium text-slate-400">/hr</span>
                             </div>
                          </div>
                          <Button size="lg" className="bg-green-600 hover:bg-green-700 rounded-2xl h-11 px-5 font-bold shadow-lg shadow-green-600/20 border-none transition-all active:scale-95">
                            Reservar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
              
              {filteredFields.length === 0 && !loading && (
                 <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                    <Trophy className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No encontramos canchas</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">Intenta ajustando los filtros o buscando en otro distrito.</p>
                    <Button variant="link" className="text-green-600 mt-4 font-bold" onClick={() => {setSearchTerm(""); setDistrict("all"); setSurfaceType("all");}}>
                       Limpiar filtros
                    </Button>
                 </div>
              )}
            </div>
          )}
        </div>

        {/* Map View */}
        <div className="hidden md:block w-full md:w-1/2 lg:w-3/5 bg-slate-200 relative z-0 h-[calc(100vh-80px)]">
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <ChangeView center={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {filteredFields.map(field => {
              const lat = field.latitude || field.location?.lat;
              const lng = field.longitude || field.location?.lng;
              
              if (!lat || !lng) return null;

              return (
                <Marker 
                  key={field.id} 
                  position={[lat, lng]}
                  icon={greenIcon}
                  eventHandlers={{
                    click: () => {
                      setHighlightedCourt(field.id);
                      const el = document.getElementById(`court-${field.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                  }}
                >
                  <Popup className="rounded-xl">
                    <div className="p-1 min-w-[200px]">
                      <img 
                        src={field.photos?.[0] || "https://picsum.photos/seed/cancha/600/400"} 
                        alt={field.name} 
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                      <h3 className="font-bold text-sm mb-1">{field.name}</h3>
                      <p className="text-xs text-slate-500 mb-2">{field.location?.address || field.address}</p>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-green-600">S/ {field.pricePerHour || field.price}</span>
                        <Link to={`/field/${field.id}`}>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                            Reservar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          
          {/* Floating Map Controls */}
          <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
            <Button 
              size="icon" 
              className="bg-white text-slate-700 hover:bg-slate-50 shadow-lg rounded-full h-12 w-12 border border-slate-200"
              onClick={locateUser}
              title="Mi ubicación"
            >
              <Navigation className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
