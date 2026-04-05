import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "@/lib/firebase";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Redirect if already logged in
  if (profile) {
    if (profile.role === "admin") navigate("/admin");
    else if (profile.role === "owner") navigate("/owner");
    else navigate("/dashboard");
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Sesión iniciada correctamente");
    } catch (error: any) {
      toast.error(error.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Sesión iniciada con Google");
    } catch (error: any) {
      toast.error(error.message || "Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">Pichangeros</span>
          </Link>
        </div>
        
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Bienvenido de vuelta</CardTitle>
            <CardDescription>
              Ingresa tus datos para acceder a tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link to="#" className="text-sm text-green-600 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? "Iniciando..." : "Iniciar Sesión"}
              </Button>
            </form>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">O continúa con</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
                Google
              </Button>
              <Button variant="outline" className="w-full">
                Facebook
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-slate-600">
              ¿No tienes cuenta?{" "}
              <Link to="/register" className="text-green-600 font-semibold hover:underline">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
