import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, LogOut, ArrowLeft } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { toast } from "sonner";

export default function Register() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get("role") === "owner" ? "owner" : "user";
  
  const [role, setRole] = useState<"user" | "owner">(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, logout, loading: authLoading } = useAuth();

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;

  if (profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 text-center shadow-xl shadow-slate-200/50 rounded-3xl border-slate-200">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Ya tienes una sesión activa</h2>
          <p className="text-slate-600 mb-8">
            Actualmente estás conectado como <strong className="text-slate-900">{profile.displayName || profile.email}</strong>. 
            ¿Deseas ir a tu panel o cerrar sesión para crear una cuenta nueva?
          </p>
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => navigate(profile.role === "owner" ? "/owner" : "/dashboard")} className="w-full h-12 rounded-xl border-green-200 text-green-700 hover:bg-green-50">
              Ir a mi panel
            </Button>
            <Button 
              onClick={async () => {
                await logout();
                toast.success("Sesión cerrada. Ahora puedes registrarte.");
              }} 
              className="w-full bg-slate-900 hover:bg-slate-800 h-12 rounded-xl"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión y registrarme
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      // Create user profile in Firestore
      const userData: any = {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: user.photoURL,
        role: role,
        phoneNumber: phoneNumber,
        createdAt: new Date().toISOString(),
      };

      if (role === "owner") {
        userData.businessName = businessName;
        userData.district = district;
      }

      await setDoc(doc(db, "users", user.uid), userData);
      
      toast.success("Cuenta creada exitosamente");
    } catch (error: any) {
      toast.error(error.message || "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Create user profile in Firestore (if it doesn't exist, though signInWithPopup might trigger the AuthProvider logic first. We'll ensure it's set correctly here)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: role,
        createdAt: new Date().toISOString(),
      }, { merge: true });
      
      toast.success("Cuenta creada con Google");
    } catch (error: any) {
      toast.error(error.message || "Error al registrarse con Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative">
      <Button 
        variant="ghost" 
        className="absolute top-4 left-4 text-slate-600 hover:text-slate-900"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al inicio
      </Button>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">Pichangeros</span>
          </Link>
        </div>
        
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Crea tu cuenta</CardTitle>
            <CardDescription>
              Únete a la comunidad más grande de pichangas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue={role} onValueChange={(v) => setRole(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="user">Jugador</TabsTrigger>
                <TabsTrigger value="owner">Dueño de Cancha</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Juan Pérez" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="tu@email.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de celular</Label>
                  <Input 
                    id="phoneNumber" 
                    type="tel" 
                    placeholder="9XXXXXXXX" 
                    required 
                    pattern="^9\d{8}$"
                    title="Debe empezar con 9 y tener 9 dígitos"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  />
                </div>

                {role === "owner" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Nombre de tu cancha o negocio</Label>
                      <Input 
                        id="businessName" 
                        placeholder="Ej: Canchas El Golazo" 
                        required 
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">Distrito donde está tu cancha</Label>
                      <Input 
                        id="district" 
                        placeholder="Ej: Miraflores" 
                        required 
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? "Creando cuenta..." : "Registrarse"}
                </Button>
              </form>
            </Tabs>
            
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">O regístrate con</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button variant="outline" onClick={handleGoogleRegister} className="w-full">
                Google
              </Button>
              <Button variant="outline" className="w-full">
                Facebook
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-slate-600">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-green-600 font-semibold hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
