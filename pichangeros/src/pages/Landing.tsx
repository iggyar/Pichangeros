import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, CreditCard, ShieldCheck, Star, Trophy, Users, Zap, Shield, Clock } from "lucide-react";
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="absolute top-0 w-full z-50 bg-transparent">
        <div className="flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold tracking-tight text-white drop-shadow-md">Pichangeros</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-white hover:text-green-300 drop-shadow-md">
              Iniciar Sesión
            </Link>
            <Link to="/register">
              <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full px-6 border-none">
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-900/20 via-slate-950 to-slate-950"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col items-start text-left">
            <Badge className="mb-6 bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-1.5 text-sm rounded-full backdrop-blur-sm">
              ⚽ La comunidad #1 de Lima
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-lg leading-tight">
              Encuentra y reserva tu <span className="text-green-400">cancha</span> en segundos
            </h1>
            <p className="text-xl text-slate-400 mb-10 max-w-xl drop-shadow-md">
              Olvídate de las llamadas y los mensajes sin respuesta. Descubre las mejores canchas de Lima, verifica disponibilidad en tiempo real y asegura tu pichanga.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link to="/search" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white rounded-full text-lg px-8 h-14 shadow-lg shadow-green-500/20 border-none">
                  Reservar una cancha
                </Button>
              </Link>
              <Link to="/register?role=owner" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-full text-lg px-8 h-14 border border-slate-700 bg-slate-800/50 text-white hover:bg-slate-800 hover:text-white backdrop-blur-sm">
                  Registrar mi cancha
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="relative hidden lg:block">
            {/* Phone Mockup */}
            <div className="relative mx-auto w-[300px] h-[600px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-3xl w-40 mx-auto z-20"></div>
              {/* Map Image */}
              <img 
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop" 
                alt="Map" 
                className="w-full h-full object-cover opacity-50"
              />
              {/* Map Pins */}
              <div className="absolute top-1/4 left-1/4 bg-green-500 p-2 rounded-full shadow-lg shadow-green-500/50 animate-bounce">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="absolute top-1/2 right-1/3 bg-green-500 p-2 rounded-full shadow-lg shadow-green-500/50 animate-bounce" style={{ animationDelay: '0.2s' }}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="absolute bottom-1/3 left-1/3 bg-green-500 p-2 rounded-full shadow-lg shadow-green-500/50 animate-bounce" style={{ animationDelay: '0.4s' }}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              {/* UI Overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent h-40 p-6 flex flex-col justify-end">
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                  <div className="text-white font-bold text-sm mb-1">La Cancha de Renzo</div>
                  <div className="text-green-400 text-xs font-medium mb-3">Disponible hoy 8:00 PM</div>
                  <div className="w-full h-8 bg-green-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">Reservar</div>
                </div>
              </div>
            </div>
            {/* Decorative blur */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/20 rounded-full blur-[100px] -z-10"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl flex flex-col items-start hover:border-green-500/30 transition-colors">
              <div className="bg-green-500/10 p-4 rounded-2xl mb-6">
                <Shield className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Confianza Total</h3>
              <p className="text-slate-400 leading-relaxed">Reservas seguras y garantizadas para ti y tu equipo. Tu pago está protegido hasta que llegues a la cancha.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl flex flex-col items-start hover:border-green-500/30 transition-colors">
              <div className="bg-green-500/10 p-4 rounded-2xl mb-6">
                <Clock className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Disponibilidad Real</h3>
              <p className="text-slate-400 leading-relaxed">Horarios actualizados al instante, sin esperas ni sorpresas. Lo que ves es lo que puedes reservar al momento.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl flex flex-col items-start hover:border-green-500/30 transition-colors">
              <div className="bg-green-500/10 p-4 rounded-2xl mb-6">
                <Star className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Calidad Comprobada</h3>
              <p className="text-slate-400 leading-relaxed">Canchas verificadas y calificadas por la comunidad. Juega solo en los mejores campos de tu distrito.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">¿Cómo funciona?</h2>
            <p className="text-slate-600 text-lg">Es muy simple, ya sea que quieras jugar o alquilar tu espacio.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For Users */}
            <div className="bg-green-500 text-slate-900 p-10 md:p-12 rounded-[2.5rem] shadow-lg relative overflow-hidden">
              <h3 className="text-3xl font-bold mb-10 flex items-center gap-4 relative z-10">
                <span className="bg-slate-900 text-green-400 p-3 rounded-2xl"><Users className="w-8 h-8" /></span>
                Para Jugadores
              </h3>
              <div className="space-y-10 relative z-10">
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">1</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Busca tu cancha ideal</h4>
                    <p className="text-slate-800/80 text-lg leading-relaxed">Filtra por distrito, precio y disponibilidad en nuestro mapa interactivo de Lima.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">2</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Reserva y paga online</h4>
                    <p className="text-slate-800/80 text-lg leading-relaxed">Paga de forma segura con tarjeta, Yape o Plin. Recibe tu código de acceso al instante.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">3</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">¡A jugar!</h4>
                    <p className="text-slate-800/80 text-lg leading-relaxed">Muestra tu código en la cancha, reúne a tu equipo y disfruta de tu pichanga.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Owners */}
            <div className="bg-slate-900 text-white p-10 md:p-12 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <h3 className="text-3xl font-bold mb-10 flex items-center gap-4 relative z-10">
                <span className="bg-slate-800 text-green-400 p-3 rounded-2xl"><ShieldCheck className="w-8 h-8" /></span>
                Para Dueños
              </h3>
              <div className="space-y-10 relative z-10">
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">1</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Registra tu local</h4>
                    <p className="text-slate-400 text-lg leading-relaxed">Sube fotos, establece tus precios y horarios disponibles en minutos.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">2</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Recibe reservas</h4>
                    <p className="text-slate-400 text-lg leading-relaxed">Gestiona todo desde tu panel. El dinero está asegurado antes de que empiece el partido.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center font-bold text-green-400 text-xl shrink-0">3</div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">Valida y cobra</h4>
                    <p className="text-slate-400 text-lg leading-relaxed">Ingresa el código del usuario al llegar y recibe tu pago automáticamente en tu cuenta.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Encuentra canchas cerca tuyo</h2>
          <p className="text-slate-600 text-lg">Canchas en todos los distritos de Lima</p>
        </div>
        
        <div className="relative h-[400px] w-full max-w-7xl mx-auto rounded-3xl overflow-hidden shadow-xl border border-slate-200">
          <div className="absolute inset-0 z-10 bg-slate-900/20 pointer-events-none"></div>
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <Link to="/search" className="pointer-events-auto">
              <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white rounded-full text-lg px-8 h-14 shadow-2xl shadow-green-500/30 border-none">
                Ver canchas disponibles
              </Button>
            </Link>
          </div>
          <div className="h-full w-full pointer-events-none">
            <MapContainer center={[-12.0464, -77.0428]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Marker position={[-12.0464, -77.0428]} icon={customIcon} />
              <Marker position={[-12.08, -77.05]} icon={customIcon} />
              <Marker position={[-12.1, -77.02]} icon={customIcon} />
              <Marker position={[-12.02, -77.06]} icon={customIcon} />
              <Marker position={[-12.05, -76.98]} icon={customIcon} />
            </MapContainer>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Lo que dicen los peloteros</h2>
            <p className="text-slate-600 text-lg">Únete a la comunidad que ya está cambiando la forma de jugar.</p>
          </div>
          
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8 -mx-6 px-6 hide-scrollbar">
            {[
              { name: "Josué Quispe", role: "Jugador frecuente, San Borja", text: "Antes perdíamos horas llamando a diferentes canchas para ver si había espacio. Ahora con Pichangeros armamos el partido en 5 minutos.", img: "https://i.pravatar.cc/150?img=11" },
              { name: "Renzo Mamani", role: 'Dueño de "La Cancha de Renzo", Los Olivos', text: "Como administrador de un complejo deportivo, esta app me salvó la vida. Ya no tengo huecos en mis horarios ni gente que reserva y no va.", img: "https://i.pravatar.cc/150?img=33" },
              { name: "Fiorella Pacheco", role: "Organizadora, Miraflores", text: "Poder pagar con Yape directamente en la app hace que recolectar la cuota de todos los amigos sea muchísimo más fácil y rápido.", img: "https://i.pravatar.cc/150?img=68" },
              { name: "Diego Huanca", role: "Jugador, San Juan de Lurigancho", text: "La mejor app para encontrar canchas. Siempre hay disponibilidad y los precios son claros. Nunca más me quedo sin jugar el fin de semana.", img: "https://i.pravatar.cc/150?img=12" }
            ].map((t, i) => (
              <div key={i} className="min-w-[85vw] md:min-w-[calc(50%-1rem)] snap-center bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex text-yellow-400 mb-6">
                    <Star className="w-6 h-6 fill-current" /><Star className="w-6 h-6 fill-current" /><Star className="w-6 h-6 fill-current" /><Star className="w-6 h-6 fill-current" /><Star className="w-6 h-6 fill-current" />
                  </div>
                  <p className="text-slate-700 mb-8 text-xl leading-relaxed italic">"{t.text}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-300 rounded-full overflow-hidden shrink-0">
                    <img src={t.img} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-lg">{t.name}</div>
                    <div className="text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-900 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">¿Listo para el próximo partido?</h2>
        <p className="text-slate-400 mb-10 max-w-2xl mx-auto text-xl">Únete hoy mismo y descubre la forma más fácil de organizar tus partidos de fútbol en Lima.</p>
        <Link to="/search">
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white rounded-full text-lg px-10 h-16 shadow-lg shadow-green-500/20 border-none mb-6">
            Buscar canchas ahora
          </Button>
        </Link>
        <div className="text-slate-400 text-sm font-medium">
          Sin registro previo • Más de 50 canchas disponibles • Reserva en 60 segundos
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-500" />
            <span className="text-xl font-bold tracking-tight text-white">Pichangeros</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 Pichangeros. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Términos</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Soporte</a>
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
