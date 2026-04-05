import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search as SearchIcon, Star, Filter, Trophy, Navigation } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
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

// Component to handle map centering
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Mock data for fallback with real Lima coordinates
const MOCK_FIELDS = [
  {
    id: "1",
    name: "Canchas El Golazo",
    description: "Canchas de grass sintético de última generación.",
    pricePerHour: 80,
    location: { address: "Av. Javier Prado Este 123, San Borja", lat: -12.086, lng: -77.001 },
    photos: ["https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop"],
    rating: 4.8,
    reviews: 124
  },
  {
    id: "2",
    name: "Pichanga Pro Surco",
    description: "Complejo deportivo con 3 canchas de fútbol 7.",
    pricePerHour: 100,
    location: { address: "Av. Caminos del Inca 456, Surco", lat: -12.112, lng: -76.993 },
    photos: ["https://images.unsplash.com/photo-1518605368461-1e1e38ce8058?q=80&w=600&auto=format&fit=crop"],
    rating: 4.5,
    reviews: 89
  },
  {
    id: "3",
    name: "La 10 de Miraflores",
    description: "Excelente ubicación y estacionamiento privado.",
    pricePerHour: 120,
    location: { address: "Calle Berlín 789, Miraflores", lat: -12.121, lng: -77.031 },
    photos: ["https://images.unsplash.com/photo-1551280857-2b9bbe5204eb?q=80&w=600&auto=format&fit=crop"],
    rating: 4.9,
    reviews: 210
  }
];

export default function Search() {
  const [fields, setFields] = useState<any[]>(MOCK_FIELDS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([-12.0464, -77.0428]); // Default: Lima
  const [mapZoom, setMapZoom] = useState(12);

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "fields"), where("status", "==", "approved"));
        const querySnapshot = await getDocs(q);
        const fetchedFields = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (fetchedFields.length > 0) {
          setFields(fetchedFields);
        }
      } catch (error) {
        console.error("Error fetching fields:", error);
        // Fallback to mock data if Firestore fails
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

  const filteredFields = fields.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.location.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-600" />
            <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">Pichangeros</span>
          </Link>
          
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar por distrito o nombre..." 
                className="pl-10 bg-slate-100 border-transparent focus-visible:ring-green-600 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* List View */}
        <div className="w-full md:w-1/2 lg:w-2/5 p-4 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{filteredFields.length} canchas encontradas</h2>
            <Button variant="outline" size="sm" onClick={locateUser} className="text-green-600 border-green-200 hover:bg-green-50">
              <Navigation className="w-4 h-4 mr-2" />
              Cerca de mí
            </Button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-10">Cargando canchas...</div>
          ) : (
            <div className="space-y-4">
              {filteredFields.map(field => (
                <Link to={`/field/${field.id}`} key={field.id} className="block group">
                  <Card className="overflow-hidden border-slate-200 hover:border-green-600 transition-colors shadow-sm">
                    <div className="flex flex-col sm:flex-row h-full">
                      <div className="w-full sm:w-2/5 h-48 sm:h-auto relative">
                        <img 
                          src={field.photos[0] || "https://picsum.photos/seed/cancha/600/400"} 
                          alt={field.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <Badge className="absolute top-2 right-2 bg-white/90 text-slate-900 hover:bg-white">
                          <Star className="w-3 h-3 text-yellow-500 mr-1 fill-yellow-500" />
                          {field.rating || "Nuevo"}
                        </Badge>
                      </div>
                      <div className="w-full sm:w-3/5 p-4 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-slate-900 group-hover:text-green-600 transition-colors line-clamp-1">
                            {field.name}
                          </h3>
                          <p className="text-slate-500 text-sm flex items-start gap-1 mt-1 line-clamp-2">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            {field.location.address}
                          </p>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-lg font-bold text-slate-900">
                            S/ {field.pricePerHour} <span className="text-sm font-normal text-slate-500">/ hora</span>
                          </div>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 rounded-full">
                            Ver más
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Map View */}
        <div className="hidden md:block w-full md:w-1/2 lg:w-3/5 bg-slate-200 relative z-0">
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
            {filteredFields.map(field => (
              field.location?.lat && field.location?.lng && (
                <Marker 
                  key={field.id} 
                  position={[field.location.lat, field.location.lng]}
                  icon={greenIcon}
                >
                  <Popup className="rounded-xl">
                    <div className="p-1 min-w-[200px]">
                      <img 
                        src={field.photos[0]} 
                        alt={field.name} 
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                      <h3 className="font-bold text-sm mb-1">{field.name}</h3>
                      <p className="text-xs text-slate-500 mb-2">{field.location.address}</p>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-green-600">S/ {field.pricePerHour}</span>
                        <Link to={`/field/${field.id}`}>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                            Reservar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
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
