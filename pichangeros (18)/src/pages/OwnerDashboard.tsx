import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, Clock, MapPin, QrCode, ShieldAlert, Trophy, CheckCircle2, Plus, Settings, DollarSign, Upload, X, CalendarDays, ChevronRight, ChevronLeft, Image as ImageIcon, ChevronDown, ArrowLeftRight, MessageSquare, Send, Activity, Paperclip, Video as VideoIcon } from "lucide-react";
import { generateTimeSlots, timeToMinutes, formatTime12h, formatSlot12h, generate30MinTimeOptions, isSlotOverlappingBooking } from "@/lib/utils";
import { collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc, onSnapshot, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import type { Libraries } from "@react-google-maps/api";

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

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

const LIMA_DISTRICTS = [
  "Miraflores", "San Borja", "San Isidro", "Surco", "La Molina", "San Miguel", 
  "Jesús María", "Lince", "Pueblo Libre", "Barranco", "Chorrillos", 
  "Villa El Salvador", "San Juan de Lurigancho", "Los Olivos", "Comas", 
  "Ate", "Santa Anita", "El Agustino", "Breña", "Cercado de Lima"
];

const PAYMENT_METHODS = [
  "Yape", "Plin", "Transferencia bancaria"
];

const LIBRARIES: Libraries = ["places"];

export default function OwnerDashboard() {
  const { user, profile, loading: authLoading, logout } = useAuth();
  const [fields, setFields] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_API_KEY || "",
    libraries: LIBRARIES
  });

  const [autocomplete, setAutocomplete] = useState<any>(null);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setSelectedLocation({ lat, lng });
        setAddressInput(place.formatted_address || "");
        
        // Extract district if possible
        const districtComponent = place.address_components?.find((c: any) => 
          c.types.includes("sublocality_level_1") || c.types.includes("locality")
        );
        if (districtComponent) {
          // You could set district state here if you have one for the form
        }
      }
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      setLoading(false);
      return;
    }
    
    // If profile is still loading or not ready, wait
    if (profile === null) {
      return;
    }

    if (profile?.role !== "owner" && profile?.role !== "admin") {
      navigate("/dashboard");
      setLoading(false);
      return;
    }
    
    // If we've reached here and everything is loaded, but wait for onSnapshot
  }, [user, profile, authLoading, navigate]);

  const [codeToConfirm, setCodeToConfirm] = useState("");
  const [expandedRowBookingId, setExpandedRowBookingId] = useState<string | null>(null);
  const [rowValidationInput, setRowValidationInput] = useState("");
  const [isFullCalendarOpen, setIsFullCalendarOpen] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>("");
  const [activeView, setActiveView] = useState("dashboard");
  const [editingField, setEditingField] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [entrancePhoto, setEntrancePhoto] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scheduleField, setScheduleField] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, string>>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [defaultOpenTime, setDefaultOpenTime] = useState("08:00");
  const [defaultCloseTime, setDefaultCloseTime] = useState("23:00");

  // Profile states
  const [district, setDistrict] = useState(profile?.district || "");
  const [paymentMethod, setPaymentMethod] = useState(profile?.paymentMethod || "");
  const [paymentAccount, setPaymentAccount] = useState(profile?.paymentAccount || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Support states
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportTopic, setSupportTopic] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportImage, setSupportImage] = useState<string | null>(null);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // Messages states
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedChatMedia, setSelectedChatMedia] = useState<{ url: string; type: "image" | "video"; name: string } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const handleReportUser = async () => {
    if (!selectedChat || !user || !reportReason.trim()) {
      toast.error("Ingresa el motivo de la denuncia");
      return;
    }
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: user.uid,
        reporterEmail: user.email,
        reportedUserId: selectedChat.otherUserId || selectedChat.participants?.find((p: string) => p !== user.uid) || "unknown",
        reportedUserName: selectedChat.otherUserName || "Usuario",
        chatId: selectedChat.id,
        reason: reportReason,
        status: "pending",
        createdAt: serverTimestamp()
      });
      toast.success("Denuncia enviada. Un administrador revisará este caso.");
      setIsReportModalOpen(false);
      setReportReason("");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Error al enviar la denuncia");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, selectedChat]);

  const handleChatMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("El archivo excede el límite de 8MB.");
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type === "video/mp4" || file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("Solo se permiten imágenes (JPG, PNG) o videos MP4.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedChatMedia({
        url: reader.result as string,
        type: isVideo ? "video" : "image",
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSupportImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen excede el límite de 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen (JPG/PNG).");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSupportImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Field attributes states
  const [surfaceType, setSurfaceType] = useState<string>("");
  const [roofType, setRoofType] = useState<string>("");
  const [lighting, setLighting] = useState<string>("");
  const [fieldSize, setFieldSize] = useState<string>("");
  const [extras, setExtras] = useState<string[]>([]);
  const [numberOfCourts, setNumberOfCourts] = useState(1);
  const [pricePerHourDay, setPricePerHourDay] = useState("");
  const [pricePerHourNight, setPricePerHourNight] = useState("");
  
  // Map Picker State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [addressInput, setAddressInput] = useState("");

  // Map Click Handler Component
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setSelectedLocation(e.latlng);
      },
    });

    return selectedLocation === null ? null : (
      <Marker position={selectedLocation} icon={greenIcon} />
    );
  };

  useEffect(() => {
    if (profile) {
      setDistrict(profile.district || "");
      setPaymentMethod(profile.paymentMethod || "");
      setPaymentAccount(profile.paymentAccount || "");
    }
  }, [profile]);

  const ALL_HOURS = generateTimeSlots(defaultOpenTime || "08:00", defaultCloseTime || "22:00");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 3 - uploadedImages.length);
      const newImages = files.map(file => URL.createObjectURL(file as Blob));
      setUploadedImages(prev => [...prev, ...newImages].slice(0, 3));
      if (uploadedImages.length === 0 && newImages.length > 0) {
        setCurrentImageIndex(0);
      }
    }
  };

  const handleEntrancePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file as Blob);
      setEntrancePhoto(url);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageIndex >= newImages.length) {
        setCurrentImageIndex(Math.max(0, newImages.length - 1));
      }
      return newImages;
    });
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % uploadedImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + uploadedImages.length) % uploadedImages.length);
  };

  useEffect(() => {
    if (scheduleField) {
      setScheduleData(scheduleField.scheduleData || {});
      setDefaultOpenTime(scheduleField.defaultOpenTime || "08:00");
      setDefaultCloseTime(scheduleField.defaultCloseTime || "22:00");
    }
  }, [scheduleField]);

  const saveSchedule = async () => {
    if (!scheduleField) return;
    try {
      await updateDoc(doc(db, "fields", scheduleField.id), {
        scheduleData,
        defaultOpenTime,
        defaultCloseTime,
        updatedAt: serverTimestamp()
      });
      toast.success("Horario guardado exitosamente");
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Error al guardar el horario");
    }
  };

  const handleSupportSubmit = async () => {
    if (!user || !supportTopic || !supportMessage) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    
    setIsSubmittingSupport(true);
    try {
      // 1) Add ticket
      const ticketRef = await addDoc(collection(db, "support_tickets"), {
        userId: user.uid,
        userEmail: user.email,
        userName: profile?.displayName || "Dueño",
        userRole: profile?.role || "dueño",
        topic: supportTopic,
        message: supportMessage,
        imageUrl: supportImage || null,
        status: "open",
        createdAt: serverTimestamp()
      });
      
      const ticketId = ticketRef.id;

      // 2) Add initial message to ticket messages subcollection
      await addDoc(collection(db, "support_tickets", ticketId, "messages"), {
        senderId: user.uid,
        senderName: profile?.displayName || "Dueño",
        text: supportMessage,
        mediaUrl: supportImage || null,
        mediaType: supportImage ? "image" : null,
        createdAt: serverTimestamp()
      });

      // 3) Create mirror chat object
      await setDoc(doc(db, "chats", `support_${ticketId}`), {
        id: `support_${ticketId}`,
        ticketId: ticketId,
        participants: [user.uid, "admin"],
        isSupport: true,
        otherUserName: "Soporte Técnico",
        otherUserPhoto: "",
        topic: supportTopic,
        lastMessage: supportMessage,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 4) Add initial message to chat messages subcollection too
      await addDoc(collection(db, "chats", `support_${ticketId}`, "messages"), {
        senderId: user.uid,
        senderName: profile?.displayName || "Dueño",
        text: supportMessage,
        createdAt: serverTimestamp()
      });

      toast.success("Ticket de soporte creado exitosamente. Se ha habilitado un chat en tiempo real con un administrador.");
      setIsSupportModalOpen(false);
      setSupportTopic("");
      setSupportMessage("");
      setSupportImage(null);
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      toast.error("Error al enviar el ticket de soporte");
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const handleViewTicketConversation = (ticketId: string) => {
    const supportChatId = `support_${ticketId}`;
    let supportChat = chats.find(c => c.id === supportChatId);
    
    if (!supportChat) {
      supportChat = {
        id: supportChatId,
        ticketId: ticketId,
        isSupport: true,
        otherUserName: "Soporte Técnico",
        otherUserPhoto: "",
        participants: [user?.uid, "admin"]
      };
    }
    
    setSelectedChat(supportChat);
    setActiveView("messages");
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get("displayName") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const businessName = formData.get("businessName") as string;
    const businessId = formData.get("businessId") as string;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        phoneNumber,
        businessName,
        businessId,
        district,
        paymentMethod,
        paymentAccount,
        updatedAt: serverTimestamp()
      });
      toast.success("Perfil actualizado exitosamente");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUploadProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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

  const handleIdentityUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 1024 * 1024) {
      toast.error("El documento es muy grande. Máximo 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, "users", user.uid), {
          identityDocumentUrl: base64String,
          identityVerified: false // Needs admin approval
        });
        toast.success("Documento subido. En revisión.");
      } catch (error) {
        console.error("Error uploading identity document:", error);
        toast.error("Error al subir el documento");
      }
    };
    reader.readAsDataURL(file);
  };

  const isWithinDefaultHours = (slot: string) => {
    const slotStartTime = slot.split(" - ")[0] || slot;
    const slotMins = timeToMinutes(slotStartTime);
    const openMins = timeToMinutes(defaultOpenTime || "08:00");
    let closeMins = timeToMinutes(defaultCloseTime || "22:00");
    if (closeMins <= openMins) closeMins += 24 * 60;
    
    if (slotMins >= openMins && slotMins < closeMins) return true;
    if (slotMins + 24 * 60 >= openMins && slotMins + 24 * 60 < closeMins) return true;
    return false;
  };

  const getSlotStatus = (date: Date, slot: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const explicitStatus = scheduleData[dateStr]?.[slot];
    if (explicitStatus) return explicitStatus;
    
    if (scheduleField) {
      const isBooked = bookings.some(b => {
        if (b.fieldId !== scheduleField.id) return false;
        if (b.date !== dateStr) return false;
        if (b.status === "Cancelado" || b.status === "cancelled" || b.status === "Rechazado") return false;
        return isSlotOverlappingBooking(slot, b.timeSlot || b.time || "");
      });
      if (isBooked) return 'reserved';
    }

    return isWithinDefaultHours(slot) ? 'open' : 'closed';
  };

  const setSlotStatus = (date: Date, slot: string, status: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setScheduleData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [slot]: status
      }
    }));
  };

  const toggleSlotStatus = (date: Date, slot: string) => {
    const current = getSlotStatus(date, slot);
    const next = current === 'open' ? 'closed' : current === 'closed' ? 'reserved' : 'open';
    setSlotStatus(date, slot, next);
  };

  const TIME_SLOTS = generateTimeSlots(defaultOpenTime || "08:00", defaultCloseTime || "22:00");
  const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));

  useEffect(() => {
    if (!user) return;
    
    const fieldsQ = query(collection(db, "fields"), where("ownerId", "==", user.uid));
    const unsubscribeFields = onSnapshot(fieldsQ, async (snap) => {
      const fetchedFields = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFields(fetchedFields);
      setLoading(false); // Only set loading to false after first successful fetch

      // Auto-approve pending fields if identity is verified
      if (profile?.identityVerified) {
        const pendingFields = fetchedFields.filter(f => f.status === "pending");
        for (const field of pendingFields) {
          try {
            await updateDoc(doc(db, "fields", field.id), {
              status: "approved",
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Error auto-approving field:", err);
          }
        }
      }
    }, (error) => {
      console.error("Error fetching fields:", error);
      handleFirestoreError(error, OperationType.LIST, "fields");
      setLoading(false); // Still set loading to false to avoid being stuck
    });

    const bookingsQ = query(
      collection(db, "bookings"), 
      where("ownerId", "==", user.uid)
    );
    const unsubscribeBookings = onSnapshot(bookingsQ, (snap) => {
      const fetchedBookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort in memory
      fetchedBookings.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      setBookings(fetchedBookings);
    }, (error) => {
      console.error("Error fetching bookings:", error);
      handleFirestoreError(error, OperationType.LIST, "bookings");
    });

    return () => {
      unsubscribeFields();
      unsubscribeBookings();
    };
  }, [user, profile?.identityVerified]);

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
        if (data.isSupport) {
          chatsData.push({
            id: data.id,
            ...data,
            otherUserName: "Soporte Técnico",
            otherUserPhoto: ""
          });
          continue;
        }

        const otherUserId = data.participants.find((id: string) => id !== user.uid);
        
        // Fetch other user's details
        let otherUserName = "Usuario";
        let otherUserPhoto = "";
        if (otherUserId) {
          try {
            const userDocSnap = await getDoc(doc(db, "users", otherUserId));
            if (userDocSnap.exists()) {
              otherUserName = userDocSnap.data().displayName || "Usuario";
              otherUserPhoto = userDocSnap.data().photoURL || "";
            }
          } catch (e) {
            console.error("Error fetching user details:", e);
          }
        }
        
        chatsData.push({
          id: data.id,
          ...data,
          otherUserName,
          otherUserPhoto
        });
      }
      setChats(chatsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });
    
    return () => unsubscribe();
  }, [user]);

  // Support Tickets Hook to fetch owner tickets
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "support_tickets"),
      where("userId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tickets.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setSupportTickets(tickets);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "support_tickets");
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedChat) return;
    
    const isSupport = selectedChat.isSupport;
    const pathRef = isSupport 
      ? collection(db, "support_tickets", selectedChat.ticketId, "messages")
      : collection(db, "chats", selectedChat.id, "messages");

    const q = query(
      pathRef,
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, isSupport ? `support_tickets/${selectedChat.ticketId}/messages` : `chats/${selectedChat.id}/messages`);
    });
    
    return () => unsubscribe();
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedChatMedia) || !selectedChat || !user) return;
    
    const messageText = newMessage.trim();
    const mediaToUpload = selectedChatMedia;
    setNewMessage("");
    setSelectedChatMedia(null);
    
    try {
      const msgData: any = {
        senderId: user.uid,
        senderName: profile?.displayName || "Dueño",
        text: messageText,
        createdAt: serverTimestamp()
      };
      if (mediaToUpload) {
        msgData.mediaUrl = mediaToUpload.url;
        msgData.mediaType = mediaToUpload.type;
      }

      const displaySummary = messageText || (mediaToUpload?.type === "video" ? "[Video adjunto]" : "[Imagen adjunta]");

      if (selectedChat.isSupport) {
        await addDoc(collection(db, "support_tickets", selectedChat.ticketId, "messages"), msgData);

        await updateDoc(doc(db, "support_tickets", selectedChat.ticketId), {
          status: "open",
          message: displaySummary,
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, "chats", selectedChat.id), {
          lastMessage: displaySummary,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "chats", selectedChat.id, "messages"), msgData);
        
        await updateDoc(doc(db, "chats", selectedChat.id), {
          lastMessage: displaySummary,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar el mensaje");
    }
  };

  const handleConfirmRowCode = async (bookingId: string, code: string) => {
    if (!code) {
      toast.error("Por favor ingresa un código");
      return;
    }

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      toast.error("Reserva no encontrada");
      return;
    }

    const match = (
      (booking.securityCode && booking.securityCode === code) ||
      (booking.checkInCode && booking.checkInCode === code) ||
      (booking.codigoLlegada && booking.codigoLlegada === code)
    );

    if (!match) {
      toast.error("Código de 4 dígitos incorrecto");
      return;
    }

    try {
      await updateDoc(doc(db, "bookings", booking.id), { 
        status: "Completado", 
        estadoPago: "Completado",
        paymentStatus: "released",
        arrivalConfirmed: true,
        updatedAt: serverTimestamp()
      });
      
      toast.success("¡Código validado! Reserva marcada como 'Completado' y habilitada para liquidación.");
      setExpandedRowBookingId(null);
      setRowValidationInput("");
    } catch (error) {
      console.error("Error confirming code:", error);
      toast.error("Error al confirmar el código");
    }
  };

  const handleSaveField = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const address = formData.get("address") as string;

    if (!name || !description || !pricePerHourDay || !pricePerHourNight || !address) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    if (!entrancePhoto) {
      toast.error("La foto de la entrada del local es obligatoria");
      return;
    }

    const initialStatus = "pending";

    try {
      if (activeView === "new_field") {
        await addDoc(collection(db, "fields"), {
          ownerId: user.uid,
          name,
          description,
          pricePerHourDay: Number(pricePerHourDay),
          pricePerHourNight: Number(pricePerHourNight),
          pricePerHour: Number(pricePerHourDay), // Fallback
          numberOfCourts: Number(numberOfCourts),
          latitude: selectedLocation?.lat || null,
          longitude: selectedLocation?.lng || null,
          location: { 
            address: addressInput || address,
            lat: selectedLocation?.lat || null,
            lng: selectedLocation?.lng || null,
            district: addressInput?.split(',').reverse()[2]?.trim() || ""
          },
          surfaceType,
          roofType,
          lighting,
          fieldSize,
          extras,
          photos: uploadedImages,
          entrancePhoto: entrancePhoto,
          openTime: defaultOpenTime,
          closeTime: defaultCloseTime,
          status: initialStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        toast.success("La cancha fue publicada, se encuentra en espera");
        
        if (initialStatus === "pending") {
          // Create a system chat
          const chatRef = await addDoc(collection(db, "chats"), {
            participants: [user.uid, "system"],
            updatedAt: serverTimestamp(),
            lastMessage: "Tu local ha sido registrado exitosamente y se encuentra en proceso de revisión."
          });
          
          await addDoc(collection(db, "chats", chatRef.id, "messages"), {
            senderId: "system",
            text: "Estimado usuario, su local ha sido registrado exitosamente y se encuentra en proceso de revisión por parte de nuestro equipo de administradores. Le notificaremos por este medio una vez que haya sido aprobado.",
            createdAt: serverTimestamp()
          });
        }
      } else if (editingField) {
        await updateDoc(doc(db, "fields", editingField.id), {
          name,
          description,
          pricePerHourDay: Number(pricePerHourDay),
          pricePerHourNight: Number(pricePerHourNight),
          pricePerHour: Number(pricePerHourDay), // Fallback
          numberOfCourts: Number(numberOfCourts),
          latitude: selectedLocation?.lat || null,
          longitude: selectedLocation?.lng || null,
          location: { 
            address: addressInput || address,
            lat: selectedLocation?.lat || null,
            lng: selectedLocation?.lng || null,
            district: addressInput?.split(',').reverse()[2]?.trim() || ""
          },
          surfaceType,
          roofType,
          lighting,
          fieldSize,
          extras,
          photos: uploadedImages,
          entrancePhoto: entrancePhoto,
          status: initialStatus,
          rejectionReason: null, // Clear rejection reason
          updatedAt: serverTimestamp(),
        });
        toast.success("Cancha actualizada con éxito");
      }
      setActiveView("fields");
    } catch (error) {
      console.error("Error saving field:", error);
      toast.error("Error al guardar la cancha");
    }
  };

  const activeBookings = bookings.filter(b => b.status === "active");
  const completedBookings = bookings.filter(b => b.status === "completed");

  const switchRole = async () => {
    if (!user) return;
    try {
      toast.success("Cambiando a vista de Jugador...");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error switching role:", error);
      toast.error("Error al cambiar de vista");
    }
  };

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  const weeklyBookings = bookings.filter(b => {
    const bookingDate = new Date(b.date);
    return bookingDate >= last7Days && bookingDate <= new Date() && b.status === "completed";
  });
  
  const weeklyIncome = weeklyBookings.reduce((acc, b) => acc + ((b.price || b.montoTotal || 0) * 0.85), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validatedToday = bookings
    .filter(b => b.status === "completed" && b.updatedAt && typeof b.updatedAt.toDate === 'function' && b.updatedAt.toDate() >= today)
    .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
    .slice(0, 5);

  const ADMIN_EMAILS = ["iggy666thepro@gmail.com", "ignaciotaipe0@gmail.com"];
  const isAdmin = profile?.role === "admin" || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

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
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold tracking-tight">Pichangeros <span className="text-green-400 text-sm font-normal">Socios</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-sm font-bold text-green-400">
                {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
              </div>
              <span className="text-sm font-medium text-slate-300 hidden sm:block">
                {profile?.displayName || "Dueño"}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => logout()} className="text-slate-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center text-white">
                <div className="w-24 h-24 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-green-400 border-4 border-slate-800 overflow-hidden shadow-inner">
                  {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
                </div>
                <h2 className="font-bold text-lg">{profile?.displayName || "Dueño"}</h2>
                <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">Dueño</Badge>
              </div>
              <div className="p-3 space-y-1">
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("profile")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "profile" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mi Perfil
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("dashboard")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "dashboard" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Panel Principal
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("fields")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "fields" || activeView === "schedule" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mis Canchas
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("finance")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "finance" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Historial de Pagos
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("messages")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "messages" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Mensajes
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveView("support")}
                  className={`w-full justify-start rounded-xl h-12 ${activeView === "support" ? "text-green-600 bg-green-50 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Soporte
                </Button>
                
                <div className="my-4 border-t border-slate-100"></div>
                
                <Button 
                  variant="outline" 
                  onClick={switchRole}
                  className="w-full justify-start rounded-xl h-12 border-green-200 text-green-700 hover:bg-green-50"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Cambiar a Jugador
                </Button>

                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/admin")}
                    className="w-full justify-start rounded-xl h-12 border-blue-200 text-blue-700 hover:bg-blue-50 mt-2"
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    Cambiar a Admin
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-8">
            
            {activeView === "dashboard" && (
              <>
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Reservas Hoy</p>
                    <h3 className="text-2xl font-bold text-slate-900">{activeBookings.length + completedBookings.length}</h3>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Ingresos Estimados</p>
                    <h3 className="text-2xl font-bold text-slate-900">S/ {bookings.reduce((acc, b) => acc + ((b.price || b.montoTotal || 0) * 0.85), 0).toFixed(2)}</h3>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Completadas</p>
                    <h3 className="text-2xl font-bold text-slate-900">{completedBookings.length}</h3>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-400" />
                    Resumen Semanal (Últimos 7 días)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Total Reservas</p>
                      <p className="text-3xl font-bold">{weeklyBookings.length}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Ingresos Generados</p>
                      <p className="text-3xl font-bold text-green-400">S/ {weeklyIncome.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bookings List */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Reservas de Hoy</h2>
                <Button 
                  variant="outline" 
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full font-bold text-xs shadow-xs"
                  onClick={() => setIsFullCalendarOpen(true)}
                >
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                  Ver calendario completo
                </Button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Horario</th>
                        <th className="px-6 py-4">Jugador</th>
                        <th className="px-6 py-4">Cancha</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.length === 0 ? (
                         <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">No hay reservas para hoy</td>
                         </tr>
                      ) : (
                        bookings.map((booking) => (
                          <React.Fragment key={booking.id}>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-5 font-black text-slate-900 whitespace-nowrap">
                                {booking.timeSlot}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                   <span className="font-bold text-slate-900 leading-tight">{booking.userName}</span>
                                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{booking.securityCode}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-slate-600 font-medium">
                                {fields.find(f => f.id === booking.fieldId)?.name || "Cancha"}
                              </td>
                              <td className="px-6 py-5">
                                {booking.status === "pending" ? (
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none rounded-lg px-2.5 py-0.5 font-bold uppercase text-[9px] tracking-wider animate-pulse">En Verificación</Badge>
                                ) : booking.status === "active" ? (
                                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none rounded-lg px-2.5 py-0.5 font-bold uppercase text-[9px] tracking-wider">En Espera</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none rounded-lg px-2.5 py-0.5 font-bold uppercase text-[9px] tracking-wider">Finalizada</Badge>
                                )}
                              </td>
                              <td className="px-6 py-5 text-right whitespace-nowrap">
                                {booking.status === "active" ? (
                                  <Button 
                                    size="sm" 
                                    variant={expandedRowBookingId === booking.id ? "ghost" : "outline"}
                                    className={`font-black rounded-xl h-9 transition-all text-xs px-3.5 ${
                                      expandedRowBookingId === booking.id 
                                        ? "text-slate-500 hover:bg-slate-100" 
                                        : "border-green-250 text-green-700 hover:bg-green-50"
                                    }`}
                                    onClick={() => {
                                      if (expandedRowBookingId === booking.id) {
                                        setExpandedRowBookingId(null);
                                        setRowValidationInput("");
                                      } else {
                                        setExpandedRowBookingId(booking.id);
                                        setRowValidationInput("");
                                      }
                                    }}
                                  >
                                    {expandedRowBookingId === booking.id ? "Cerrar" : "Validar código"}
                                  </Button>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5 text-green-600 font-black text-xs select-none">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    <span>Completado</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {expandedRowBookingId === booking.id && (
                              <tr className="bg-slate-50 border-t border-b border-slate-100">
                                <td colSpan={5} className="p-4 px-6 bg-green-50/30">
                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-2.5">
                                      <QrCode className="w-5 h-5 text-emerald-600 animate-pulse shrink-0" />
                                      <p className="text-xs text-green-900 font-bold text-left">
                                        Ingresa el código de 4 dígitos proporcionado por el jugador al llegar a la cancha.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto max-w-xs justify-end">
                                      <Input 
                                        type="tel"
                                        pattern="[0-9]*"
                                        maxLength={4}
                                        placeholder="Código"
                                        className="h-9 w-24 text-center tracking-widest font-black text-slate-800 focus-visible:ring-green-600 bg-white shadow-xs rounded-xl"
                                        value={rowValidationInput}
                                        onChange={(e) => setRowValidationInput(e.target.value.replace(/\D/g, ''))}
                                      />
                                      <Button 
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 font-bold text-xs rounded-xl h-9 px-4 shrink-0 transition-all hover:scale-105"
                                        onClick={() => handleConfirmRowCode(booking.id, rowValidationInput)}
                                      >
                                        Validar
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
              </>
            )}

            {activeView === "fields" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Mis Canchas</h2>
                  <Button className="bg-green-600 hover:bg-green-700 rounded-xl" onClick={() => { 
                    setEditingField(null); 
                    setUploadedImages([]); 
                    setEntrancePhoto("");
                    setNumberOfCourts(1);
                    setPricePerHourDay("");
                    setPricePerHourNight("");
                    setAddressInput("");
                    setSelectedLocation(null);
                    setSurfaceType("");
                    setRoofType("");
                    setLighting("");
                    setFieldSize("");
                    setExtras([]);
                    setActiveView("new_field"); 
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Local
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map(field => (
                    <Card key={field.id} className={`border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden transition-colors group ${field.status === 'approved' ? 'hover:border-green-300 cursor-pointer' : 'opacity-80'}`} onClick={() => { if (field.status === 'approved') { setScheduleField(field); setActiveView("schedule"); } }}>
                      <CardContent className="p-0 flex flex-col">
                        <div className="w-full h-56 bg-slate-200 relative overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop" alt={field.name} className={`w-full h-full object-cover transition-transform duration-500 ${field.status === 'approved' ? 'group-hover:scale-105' : ''}`} />
                          {field.status === 'approved' && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                              <p className="text-white font-medium flex items-center gap-2">
                                <CalendarDays className="w-5 h-5" />
                                Haz clic para ver horarios
                              </p>
                            </div>
                          )}
                          <div className="absolute top-4 right-4">
                            {field.status === "approved" && <Badge className="bg-green-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Activa</Badge>}
                            {field.status === "pending" && <Badge className="bg-blue-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Pendiente</Badge>}
                            {field.status === "rejected" && <Badge className="bg-red-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Rechazada</Badge>}
                            {field.status === "inactive" && <Badge className="bg-slate-500 text-white border-none shadow-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">Inactiva</Badge>}
                          </div>
                        </div>
                        <div className="p-6 flex flex-col justify-between flex-1 bg-white">
                          <div>
                            <h3 className="font-bold text-2xl text-slate-900 mb-1">{field.name}</h3>
                            <p className="text-green-600 font-bold text-lg">S/ {field.pricePerHour} <span className="text-slate-500 text-sm font-normal">/ hora</span></p>
                            
                            {/* Field Attributes Summary */}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {field.surfaceType && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.surfaceType}</Badge>
                              )}
                              {field.fieldSize && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.fieldSize}</Badge>
                              )}
                              {field.roofType && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">{field.roofType}</Badge>
                              )}
                            </div>

                            {field.status === "rejected" && field.rejectionReason && (
                              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-sm text-red-800 font-medium flex items-start gap-2">
                                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                  <span><strong>Motivo de rechazo:</strong> {field.rejectionReason}</span>
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                            <Button 
                              variant="ghost" 
                              disabled={field.status !== 'approved'} 
                              className="text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-xl font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleField(field);
                                setActiveView("schedule");
                              }}
                            >
                              <CalendarDays className="w-4 h-4 mr-2" />
                              Ver Horarios
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700" onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingField(field);
                              setSurfaceType(field.surfaceType || "");
                              setRoofType(field.roofType || "");
                              setLighting(field.lighting || "");
                              setFieldSize(field.fieldSize || "");
                              setExtras(field.extras || []);
                              setNumberOfCourts(field.numberOfCourts || 1);
                              setPricePerHourDay(field.pricePerHourDay?.toString() || field.pricePerHour?.toString() || "");
                              setPricePerHourNight(field.pricePerHourNight?.toString() || field.pricePerHour?.toString() || "");
                              setAddressInput(field.location?.address || field.address || "");
                              setSelectedLocation(field.location?.lat && field.location?.lng ? { lat: field.location.lat, lng: field.location.lng } : field.latitude && field.longitude ? { lat: field.latitude, lng: field.longitude } : null);
                              setUploadedImages(field.photos || ["https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=600&auto=format&fit=crop"]); 
                              setEntrancePhoto(field.entrancePhoto || "");
                              setActiveView("edit_field"); 
                            }}>
                              Editar Local
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeView === "schedule" && scheduleField && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setActiveView("fields")} className="rounded-full bg-white shadow-sm border border-slate-200">
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Horarios: {scheduleField.name}</h2>
                      <p className="text-slate-500">Gestiona la disponibilidad de tu cancha</p>
                    </div>
                  </div>
                  <Button onClick={saveSchedule} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 px-6">
                    Guardar Cambios
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Settings / Fixed Schedule */}
                  <div className="lg:col-span-1 space-y-6">
                    <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl">
                      <CardHeader className="border-b border-slate-100 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Settings className="w-5 h-5 text-slate-500" />
                          Horario Fijo (Todos los días)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-slate-500">Define tu horario de atención. Fuera de este horario, la cancha aparecerá como <strong>Cerrada</strong> por defecto.</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold">Hora de Apertura</Label>
                            <Select value={defaultOpenTime} onValueChange={setDefaultOpenTime}>
                              <SelectTrigger className="h-12 rounded-xl bg-slate-50 text-base font-bold">
                                <SelectValue placeholder="Selecciona hora de apertura" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 z-[1000]">
                                {generate30MinTimeOptions().map(t => (
                                  <SelectItem key={t} value={t}>{formatTime12h(t)} ({t})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-700 font-bold">Hora de Cierre</Label>
                            <Select value={defaultCloseTime} onValueChange={setDefaultCloseTime}>
                              <SelectTrigger className="h-12 rounded-xl bg-slate-50 text-base font-bold">
                                <SelectValue placeholder="Selecciona hora de cierre" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 z-[1000]">
                                {generate30MinTimeOptions().map(t => (
                                  <SelectItem key={t} value={t}>{formatTime12h(t)} ({t})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12" onClick={saveSchedule}>
                            Guardar Horario Fijo
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Days Accordion */}
                  <div className="lg:col-span-2 space-y-4">
                    {nextDays.map((day, idx) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isExpanded = expandedDay === dateStr;
                      
                      return (
                        <Card key={idx} className="border-slate-200 shadow-sm rounded-2xl overflow-hidden transition-all">
                          <button
                            onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
                            className={`w-full flex items-center justify-between p-6 transition-colors ${isExpanded ? "bg-green-600 text-white" : "bg-white hover:bg-slate-50 text-slate-900"}`}
                          >
                            <div className="text-left flex items-center gap-4">
                              <CalendarDays className={`w-6 h-6 ${isExpanded ? "text-green-200" : "text-slate-400"}`} />
                              <div>
                                <p className={`text-sm font-bold uppercase tracking-wider ${isExpanded ? "text-green-100" : "text-slate-500"}`}>
                                  {format(day, "EEEE", { locale: es })}
                                </p>
                                <p className={`text-xl font-bold ${isExpanded ? "text-white" : "text-slate-900"}`}>
                                  {format(day, "d 'de' MMMM", { locale: es })}
                                </p>
                              </div>
                            </div>
                            <ChevronDown className={`w-6 h-6 transition-transform ${isExpanded ? "rotate-180 text-green-200" : "text-slate-400"}`} />
                          </button>
                          
                          {isExpanded && (
                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                              <div className="flex gap-4 mb-6 justify-end text-xs font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1 text-green-700"><div className="w-3 h-3 rounded-full bg-green-500"></div> Abierto</span>
                                <span className="flex items-center gap-1 text-red-700"><div className="w-3 h-3 rounded-full bg-red-500"></div> Cerrado</span>
                                <span className="flex items-center gap-1 text-blue-700"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Reservado</span>
                              </div>
                              
                              <div className="space-y-3">
                                {ALL_HOURS.map(slot => {
                                  const status = getSlotStatus(day, slot);
                                  return (
                                    <div key={slot} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white shadow-sm gap-4">
                                      <span className="font-bold text-slate-700 text-lg">{formatSlot12h(slot)}</span>
                                      <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'open')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'open' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Abierto
                                        </button>
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'closed')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'closed' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Cerrado
                                        </button>
                                        <button 
                                          onClick={() => setSlotStatus(day, slot, 'reserved')}
                                          className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${status === 'reserved' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                        >
                                          Reservado
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeView === "finance" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Historial de Pagos</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-slate-200 shadow-sm rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-green-800 mb-1">Monto Liberado (Cobrable)</p>
                      <h3 className="text-3xl font-bold text-green-900">
                        S/ {bookings
                          .filter(b => b.paymentStatus === 'released')
                          .reduce((acc, b) => acc + (b.price || 0), 0)
                          .toFixed(2)}
                      </h3>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm rounded-2xl">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-slate-500 mb-1">Pendiente de Liberación</p>
                      <h3 className="text-3xl font-bold text-slate-900">
                        S/ {bookings
                          .filter(b => b.paymentStatus === 'paid')
                          .reduce((acc, b) => acc + (b.price || 0), 0)
                          .toFixed(2)}
                      </h3>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200 shadow-sm rounded-2xl">
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-slate-500 mb-1">Total Ingresos Totales</p>
                      <h3 className="text-3xl font-bold text-slate-900">
                        S/ {bookings
                          .filter(b => b.paymentStatus === 'paid' || b.paymentStatus === 'released')
                          .reduce((acc, b) => acc + (b.price || 0), 0)
                          .toFixed(2)}
                      </h3>
                    </CardContent>
                  </Card>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 text-blue-800">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">Los pagos se depositan a tu cuenta una vez que la reserva sea finalizada (cuando el jugador confirme su llegada con el código de 4 dígitos).</p>
                </div>

                <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="font-bold text-slate-900">Pagos Realizados</h3>
                    <Tabs defaultValue="week" className="w-full sm:w-auto">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="week">Esta semana</TabsTrigger>
                        <TabsTrigger value="month">Este mes</TabsTrigger>
                        <TabsTrigger value="all">Todo el tiempo</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold">Fecha</th>
                          <th className="px-6 py-4 font-bold">ID Reserva</th>
                          <th className="px-6 py-4 font-bold">Jugador</th>
                          <th className="px-6 py-4 font-bold">Monto (S/)</th>
                          <th className="px-6 py-4 font-bold">Estado</th>
                          <th className="px-6 py-4 font-bold text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings
                          .filter(b => b.paymentStatus === 'released' || b.status === "completed")
                          .map((payment, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-600">{payment.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{payment.id}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{payment.userName || "Jugador"}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">S/ {(payment.price || 0).toFixed(2)}</td>
                            <td className="px-6 py-4">
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Pagado</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => {
                                setActiveView("messages");
                                toast.info(`Iniciando chat con ${payment.userName || "Jugador"}...`);
                              }}>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Mensaje
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {bookings.filter(b => b.paymentStatus === 'released' || b.status === "completed").length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay pagos registrados aún.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeView === "messages" && (
              <div className="h-[700px] bg-slate-100 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
                <div className="flex h-full w-full">
                  {/* Left Column: List (hidden on mobile when chat is selected) */}
                  <div className={`w-full md:w-[360px] flex flex-col bg-white border-r border-slate-200 shrink-0 h-full ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    {/* Header */}
                    <div className="h-16 bg-slate-50 border-b border-slate-100 flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center border border-green-200 shadow-sm">
                          {profile?.photoURL ? (
                            <img src={profile.photoURL} alt="Mi" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            profile?.displayName?.charAt(0).toUpperCase() || "D"
                          )}
                        </div>
                        <span className="font-extrabold text-slate-900 text-base">Chats</span>
                      </div>
                      <MessageSquare className="w-5 h-5 text-slate-400" />
                    </div>

                    {/* Chat List Wrapper */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
                      {chats.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 py-20">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-400" />
                          <p className="text-sm font-semibold">No tienes conversaciones</p>
                          <p className="text-xs text-slate-400 mt-1">Los chats aparecerán aquí al recibir consultas de jugadores o soporte.</p>
                        </div>
                      ) : (
                        chats.map(chat => {
                          const isSelected = selectedChat?.id === chat.id;
                          const firstLetter = chat.otherUserName ? chat.otherUserName.charAt(0).toUpperCase() : "U";
                          return (
                            <div 
                              key={chat.id}
                              onClick={() => setSelectedChat(chat)}
                              className={`p-4 cursor-pointer transition-all flex items-center gap-4 hover:bg-slate-50/80 relative rounded-none select-none border-l-4 ${
                                isSelected ? 'bg-green-50/50 border-l-green-600' : 'border-l-transparent'
                              }`}
                            >
                              {chat.isSupport ? (
                                <div className="w-12 h-12 rounded-full bg-slate-900 text-green-400 font-bold flex items-center justify-center shrink-0 border border-slate-800 shadow-md">
                                  <ShieldAlert className="w-5 h-5 text-green-400" />
                                </div>
                              ) : chat.otherUserPhoto ? (
                                <img 
                                  src={chat.otherUserPhoto} 
                                  alt={chat.otherUserName} 
                                  className="w-11 h-11 rounded-full object-cover shrink-0 border border-slate-200/80 shadow-sm" 
                                  referrerPolicy="no-referrer" 
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 font-black text-sm flex items-center justify-center shrink-0 border border-green-200/30">
                                  {firstLetter}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-bold text-slate-800 truncate text-sm leading-none">{chat.otherUserName}</h4>
                                    {chat.isSupport && (
                                      <span className="bg-green-100 text-green-800 font-extrabold rounded-md px-1 py-0.5 text-[8px] uppercase tracking-wide border border-green-200">Soporte</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 truncate font-medium pr-2 leading-none">{chat.lastMessage || "Conversación iniciada"}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Chat Window */}
                  <div className={`flex-1 flex flex-col h-full bg-[#f8f9fa] ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
                    {selectedChat ? (
                      <div className="flex flex-col h-full bg-[#efeae2] relative">
                        {/* Header styled as WhatsApp */}
                        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 shrink-0 select-none z-10 shadow-xs">
                          <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="md:hidden p-0 rounded-full h-9 w-9 text-slate-600 hover:bg-slate-100" onClick={() => setSelectedChat(null)}>
                              <ArrowLeftRight className="w-5 h-5" />
                            </Button>
                            
                            {selectedChat.isSupport ? (
                              <div className="w-10 h-10 rounded-full bg-slate-900 text-green-400 font-bold flex items-center justify-center shrink-0 border border-slate-800">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                            ) : selectedChat.otherUserPhoto ? (
                              <img 
                                src={selectedChat.otherUserPhoto} 
                                alt={selectedChat.otherUserName} 
                                className="w-10 h-10 rounded-full object-cover border border-slate-200" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center border border-green-200/30">
                                {selectedChat.otherUserName ? selectedChat.otherUserName.charAt(0).toUpperCase() : "U"}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-black text-slate-900 text-sm md:text-base leading-none">{selectedChat.otherUserName}</h3>
                                {selectedChat.isSupport && (
                                  <span className="bg-green-100 text-green-800 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Verificado</span>
                                )}
                              </div>
                              <span className="text-[10px] text-green-600 font-bold mt-0.5 block leading-none">
                                {selectedChat.isSupport ? "Soporte oficial activo" : "Online"}
                              </span>
                            </div>
                          </div>

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 rounded-xl font-bold text-xs px-3.5 transition-colors shrink-0"
                            onClick={() => setIsReportModalOpen(true)}
                          >
                            Denunciar
                          </Button>
                        </div>

                        {/* Banner warning */}
                        <div className="bg-amber-50 border-b border-amber-200/50 p-2.5 px-4 text-xs text-amber-900 flex items-start gap-2 shrink-0 z-10 font-medium">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 animate-pulse" />
                          <p><strong>Seguridad Pichangeros:</strong> Comunícate con respeto. Todos los mensajes se guardan de forma encriptada bajo normas de convivencia.</p>
                        </div>

                        {/* WhatsApp Message Area */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3 flex flex-col bg-[#efeae2]/90">
                          {chatMessages.map(msg => {
                            const isMe = msg.senderId === user?.uid;
                            const isSystem = msg.senderId === "system";
                            
                            if (isSystem) {
                              return (
                                <div key={msg.id} className="flex justify-center my-1 select-none">
                                  <div className="max-w-[85%] bg-white/95 border border-slate-100 text-[11px] font-semibold text-slate-500 rounded-xl px-4 py-1.5 text-center shadow-xs">
                                    {msg.text}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-xl px-4 py-2 text-sm shadow-xs ${
                                  isMe 
                                    ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border-none border-transparent' 
                                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-150'
                                }`}>
                                  {msg.mediaUrl && (
                                    <div className="mb-2 overflow-hidden rounded-lg">
                                      {msg.mediaType === "video" ? (
                                        <video src={msg.mediaUrl} controls className="max-w-xs max-h-56 rounded-lg w-full" />
                                      ) : (
                                        <img 
                                          src={msg.mediaUrl} 
                                          alt="Adjunto" 
                                          className="max-w-xs max-h-56 rounded-lg w-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                                          onClick={() => window.open(msg.mediaUrl, '_blank')}
                                        />
                                      )}
                                    </div>
                                  )}
                                  {msg.text && <p className="font-medium outline-none whitespace-pre-wrap break-words">{msg.text}</p>}
                                  <div className="text-right mt-1 h-3 flex items-center justify-end select-none">
                                    <span className="text-[9px] text-slate-400 font-medium font-sans block">
                                      {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Reciente'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Bottom Input Area styled as WhatsApp */}
                        <div className="p-3 md:p-4 bg-[#f0f2f5] border-t border-slate-200 shrink-0 space-y-2">
                          {selectedChatMedia && (
                            <div className="flex items-center justify-between bg-[#00a884]/10 border border-[#00a884]/30 p-2.5 px-3.5 rounded-2xl">
                              <div className="flex items-center gap-2 overflow-hidden">
                                {selectedChatMedia.type === "video" ? (
                                  <VideoIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                                ) : (
                                  <img src={selectedChatMedia.url} alt="Preview" className="w-8 h-8 rounded object-cover shrink-0" />
                                )}
                                <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">{selectedChatMedia.name}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setSelectedChatMedia(null)}>
                                <X className="w-4 h-4 text-slate-500" />
                              </Button>
                            </div>
                          )}
                          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <label className="p-2.5 hover:bg-slate-200/60 rounded-full cursor-pointer text-slate-500 hover:text-emerald-600 transition-colors shrink-0" title="Adjuntar imagen o video (Máx. 8MB)">
                              <Paperclip className="w-5 h-5" />
                              <input 
                                type="file" 
                                accept="image/jpeg,image/png,video/mp4" 
                                className="hidden" 
                                onChange={handleChatMediaSelect} 
                              />
                            </label>
                            <Input 
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Escribe un mensaje..."
                              className="flex-1 rounded-full bg-white border-none focus-visible:ring-emerald-500 shadow-sm text-sm h-11 px-5"
                            />
                            <Button type="submit" size="icon" className="rounded-full bg-emerald-600 hover:bg-[#00a884] shrink-0 h-11 w-11 shadow-md shadow-emerald-600/10 text-white">
                              <Send className="w-4 h-4" />
                            </Button>
                          </form>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-[#f8f9fa]">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-15 text-slate-600" />
                        <h3 className="text-lg font-black text-slate-700 mb-1">Pichangeros Mensajería</h3>
                        <p className="text-sm text-slate-500 max-w-sm">Selecciona una conversación a la izquierda para conversar en tiempo real.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeView === "support" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Soporte Técnico</h2>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={() => setIsSupportModalOpen(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contactar Soporte
                  </Button>
                </div>

                <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                    <CardTitle className="text-lg font-bold text-slate-900">Tus Tickets de Soporte</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-slate-100">
                    {supportTickets.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium text-slate-700">No tienes solicitudes de soporte activas.</p>
                        <p className="text-xs text-slate-400 mt-1">Si tienes alguna consulta sobre tus pagos o tus canchas, escríbenos.</p>
                      </div>
                    ) : (
                      supportTickets.map(ticket => (
                        <div key={ticket.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm md:text-base">{ticket.topic}</span>
                              <Badge className={
                                ticket.status === "open" ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none" :
                                ticket.status === "resolved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none" :
                                "bg-slate-100 text-slate-800 hover:bg-slate-100 border-none"
                              }>
                                {ticket.status === "open" ? "Abierto" : ticket.status === "resolved" ? "Resuelto" : ticket.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-1">{ticket.message}</p>
                            {ticket.imageUrl && (
                              <div className="mt-1">
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                  <Paperclip className="w-3 h-3" /> Imagen adjunta
                                </span>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold shrink-0"
                            onClick={() => handleViewTicketConversation(ticket.id)}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Ver Chat de Soporte
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeView === "profile" && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Mi Perfil</h2>
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-green-600 to-green-400 w-full relative">
                    <div className="absolute -bottom-12 left-8">
                      <div className="w-24 h-24 bg-white rounded-full p-1 shadow-xl">
                        <div className="w-full h-full bg-slate-200 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold text-slate-500">
                          {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.charAt(0) || "D"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-8 pt-16 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{profile?.displayName || "Dueño"}</h3>
                        <p className="text-slate-500 font-medium">{user?.email}</p>
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          id="owner-photo-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handlePhotoUploadProfile}
                        />
                        <Label htmlFor="owner-photo-upload" className="cursor-pointer">
                          <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            <Upload className="w-4 h-4 mr-2" />
                            Cambiar Foto
                          </div>
                        </Label>
                      </div>
                    </div>
                    
                    <form onSubmit={handleSaveProfile}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Información Personal</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Nombre Completo</Label>
                              <Input name="displayName" defaultValue={profile?.displayName || ""} className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Correo Electrónico</Label>
                              <Input defaultValue={user?.email || ""} disabled className="h-12 rounded-xl bg-slate-100 text-slate-500 border-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Número Personal</Label>
                              <Input name="phoneNumber" defaultValue={profile?.phoneNumber || ""} placeholder="+51 999 999 999" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
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
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Información del Negocio</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Razón Social</Label>
                              <Input name="businessName" defaultValue={profile?.businessName || ""} placeholder="Nombre de tu empresa" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Número de negocio (teléfono para clientes)</Label>
                              <Input name="businessId" defaultValue={profile?.businessId || ""} placeholder="Ej: 999 888 777" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Método de Cobro Preferido</Label>
                              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-green-500">
                                  <SelectValue placeholder="Selecciona un método" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {paymentMethod && (
                              <div className="space-y-2">
                                <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">
                                  {paymentMethod === "Transferencia bancaria" ? "Número de Cuenta (CCI)" : "Número de Teléfono"}
                                </Label>
                                <Input 
                                  value={paymentAccount} 
                                  onChange={(e) => setPaymentAccount(e.target.value)}
                                  placeholder={paymentMethod === "Transferencia bancaria" ? "000-000-000000000000-00" : "+51 999 999 999"} 
                                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 space-y-6">
                        <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Verificación de Identidad</h4>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div>
                            <p className="text-slate-900 font-bold mb-1">Documento de Identidad (DNI o RUC)</p>
                            <p className="text-sm text-slate-500">Requerido para que tus canchas pasen de Pendiente a Activa.</p>
                            {profile?.identityVerified ? (
                              <Badge className="mt-2 bg-green-100 text-green-800 hover:bg-green-100">Verificado</Badge>
                            ) : profile?.identityDocumentUrl ? (
                              <Badge className="mt-2 bg-blue-100 text-blue-800 hover:bg-blue-100">En revisión</Badge>
                            ) : (
                              <Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <input 
                              type="file" 
                              id="identity-upload" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleIdentityUpload}
                            />
                            <Label htmlFor="identity-upload" className="cursor-pointer">
                              <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                                <Upload className="w-4 h-4 mr-2" />
                                Subir Documento
                              </div>
                            </Label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100 flex justify-end mt-8">
                        <Button type="submit" disabled={isSavingProfile} className="bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl text-base font-bold shadow-lg shadow-green-600/20">
                          {isSavingProfile ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {(activeView === "new_field" || activeView === "edit_field") && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {activeView === "new_field" ? "Nuevo Local" : "Editar Local"}
                  </h2>
                  <Button variant="outline" onClick={() => setActiveView("fields")} className="rounded-xl">
                    Cancelar
                  </Button>
                </div>
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                  <CardContent className="p-8 space-y-8">
                    {/* Foto de la entrada del local (Obligatorio) */}
                    <div className="space-y-4 pb-6 border-b border-slate-100">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-700 font-bold text-lg flex items-center gap-1.5">
                          Foto de la entrada del local <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <span className="text-xs font-semibold text-red-500 bg-red-50 px-3 py-1 rounded-full uppercase tracking-wider">Obligatorio</span>
                      </div>
                      
                      {entrancePhoto ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-lg group max-w-2xl mx-auto">
                          <img 
                            src={entrancePhoto} 
                            alt="Entrada del local" 
                            className="w-full h-full object-cover" 
                          />
                          <button 
                            onClick={(e) => { e.preventDefault(); setEntrancePhoto(""); }} 
                            className="absolute top-4 right-4 bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors shadow-lg"
                            title="Eliminar foto de entrada"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-red-200 rounded-3xl aspect-video flex flex-col items-center justify-center text-slate-500 hover:bg-red-50/50 hover:border-red-400 hover:text-red-600 cursor-pointer transition-all bg-slate-50 hover:shadow-inner group max-w-2xl mx-auto">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform border border-red-100">
                            <Upload className="w-8 h-8 text-red-400 group-hover:text-red-500" />
                          </div>
                          <span className="text-lg font-bold text-slate-700 group-hover:text-red-700">Sube la foto de la entrada</span>
                          <span className="text-sm text-slate-500 mt-1">Requerido para permitir el registro de cancha</span>
                          <input type="file" hidden accept="image/*" onChange={handleEntrancePhotoUpload} />
                        </label>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <Label className="text-slate-700 font-bold text-lg">Fotos del Local</Label>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{uploadedImages.length} de 3 permitidas</span>
                      </div>
                      
                      {uploadedImages.length > 0 ? (
                        <div className="space-y-4">
                          {/* Main Slider View */}
                          <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 group shadow-lg">
                            <img 
                              src={uploadedImages[currentImageIndex]} 
                              alt={`Local ${currentImageIndex + 1}`} 
                              className="w-full h-full object-cover transition-opacity duration-300" 
                            />
                            
                            {/* Slider Controls */}
                            {uploadedImages.length > 1 && (
                              <>
                                <button 
                                  onClick={(e) => { e.preventDefault(); prevImage(); }}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                >
                                  <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { e.preventDefault(); nextImage(); }}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                >
                                  <ChevronRight className="w-6 h-6" />
                                </button>
                                
                                {/* Indicators */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                  {uploadedImages.map((_, idx) => (
                                    <button 
                                      key={idx}
                                      onClick={(e) => { e.preventDefault(); setCurrentImageIndex(idx); }}
                                      className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImageIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                                    />
                                  ))}
                                </div>
                              </>
                            )}
                            
                            {/* Delete Button */}
                            <button 
                              onClick={(e) => { e.preventDefault(); removeImage(currentImageIndex); }} 
                              className="absolute top-4 right-4 bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors shadow-lg"
                              title="Eliminar esta foto"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Thumbnails & Add More */}
                          <div className="flex gap-4 overflow-x-auto pb-2">
                            {uploadedImages.map((img, idx) => (
                              <button 
                                key={idx}
                                onClick={(e) => { e.preventDefault(); setCurrentImageIndex(idx); }}
                                className={`relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${idx === currentImageIndex ? "border-green-500 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
                              >
                                <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                            
                            {uploadedImages.length < 3 && (
                              <label className="w-24 h-24 shrink-0 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-colors bg-slate-50">
                                <Plus className="w-6 h-6 mb-1" />
                                <span className="text-xs font-bold">Añadir</span>
                                <input type="file" hidden multiple accept="image/*" onChange={handleImageUpload} />
                              </label>
                            )}
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 rounded-3xl aspect-video flex flex-col items-center justify-center text-slate-500 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-all bg-slate-50 hover:shadow-inner group">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-green-500" />
                          </div>
                          <span className="text-lg font-bold text-slate-700 group-hover:text-green-700">Sube fotos de tu local</span>
                          <span className="text-sm text-slate-500 mt-1">Haz clic o arrastra hasta 3 imágenes</span>
                          <input type="file" hidden multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                    
                    <form onSubmit={handleSaveField}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Nombre del Local</Label>
                          <Input name="name" defaultValue={editingField?.name || ""} placeholder="Ej: Complejo Deportivo El Golazo" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 text-lg" required />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Descripción</Label>
                          <Input name="description" defaultValue={editingField?.description || ""} placeholder="Detalles del local, tipo de pasto, medidas..." className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Cantidad de Canchas</Label>
                          <Input 
                            type="number" 
                            min="1"
                            value={numberOfCourts} 
                            onChange={(e) => setNumberOfCourts(Number(e.target.value))} 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 text-lg font-bold" 
                            required 
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Dirección Exacta (Google Places)</Label>
                          <div className="block space-y-4">
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-20 pointer-events-none" />
                              <style>{`
                                .pac-container {
                                  z-index: 10000 !important;
                                  border-radius: 12px !important;
                                  border: 1px solid #e2e8f0 !important;
                                  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                                  margin-top: 4px !important;
                                  padding: 6px 0 !important;
                                }
                                .pac-item {
                                  padding: 8px 12px !important;
                                  cursor: pointer !important;
                                  border-top: 1px solid #f1f5f9 !important;
                                }
                                .pac-item:hover, .pac-item-selected {
                                  background-color: #f8fafc !important;
                                }
                                .pac-item:first-of-type {
                                  border-top: none !important;
                                }
                                .pac-icon {
                                  margin-top: 2px !important;
                                }
                              `}</style>
                              {isLoaded ? (
                                <Autocomplete
                                  onLoad={setAutocomplete}
                                  onPlaceChanged={onPlaceChanged}
                                  options={{
                                    componentRestrictions: { country: "pe" },
                                    fields: ["address_components", "geometry", "formatted_address"],
                                    types: ["address"]
                                  }}
                                  className="w-full"
                                >
                                  <Input 
                                    name="address" 
                                    value={addressInput}
                                    onChange={(e) => setAddressInput(e.target.value)}
                                    placeholder="Av. Los Pinos 123" 
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-12 w-full" 
                                    required 
                                  />
                                </Autocomplete>
                              ) : (
                                <Input 
                                  name="address" 
                                  value={addressInput}
                                  onChange={(e) => setAddressInput(e.target.value)}
                                  placeholder="Av. Los Pinos 123" 
                                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-12 w-full" 
                                  required 
                                />
                              )}
                            </div>

                            {/* Mapa interactivo con marcador arrastrable debajo */}
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ubicación de la Cancha (Organiza arrastrando el marcador)</span>
                              <div className="w-full h-72 rounded-3xl overflow-hidden border border-slate-200 relative z-10 shadow-inner">
                                <MapContainer
                                  center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [-12.0464, -77.0428]}
                                  zoom={selectedLocation ? 16 : 13}
                                  style={{ height: "100%", width: "100%" }}
                                  zoomControl={true}
                                >
                                  <ChangeView 
                                    center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [-12.0464, -77.0428]} 
                                    zoom={selectedLocation ? 17 : 13} 
                                  />
                                  <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                  />
                                  <Marker
                                    draggable={true}
                                    position={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [-12.0464, -77.0428]}
                                    icon={greenIcon}
                                    eventHandlers={{
                                      dragend: (e) => {
                                        const marker = e.target;
                                        const position = marker.getLatLng();
                                        const lat = position.lat;
                                        const lng = position.lng;
                                        
                                        setSelectedLocation({ lat, lng });
                                        
                                        // Google Geocoding to translate coordinate to address
                                        if (window.google && window.google.maps) {
                                          const geocoder = new window.google.maps.Geocoder();
                                          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                                            if (status === "OK" && results && results[0]) {
                                              setAddressInput(results[0].formatted_address);
                                            }
                                          });
                                        }
                                      }
                                    }}
                                  />
                                </MapContainer>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Precio por Hora (Día) S/</Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">S/</span>
                            <Input value={pricePerHourDay} onChange={(e) => setPricePerHourDay(e.target.value)} type="number" placeholder="80" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-10 text-lg font-bold" required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Precio por Hora (Noche) S/</Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">S/</span>
                            <Input value={pricePerHourNight} onChange={(e) => setPricePerHourNight(e.target.value)} type="number" placeholder="100" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 pl-10 text-lg font-bold" required />
                          </div>
                        </div>
                        
                        {/* New Field Attributes */}
                        <div className="space-y-4 md:col-span-2 pt-4 border-t border-slate-100">
                          <h3 className="font-bold text-lg text-slate-900">Horario General</h3>
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 mb-4">
                            <strong>Aviso:</strong> Este es el horario general de tu local. Podrás modificarlo o especificar horarios por día una vez que el local sea aprobado.
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Hora de Apertura</Label>
                              <Input 
                                type="time" 
                                value={defaultOpenTime}
                                onChange={(e) => setDefaultOpenTime(e.target.value)}
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Hora de Cierre</Label>
                              <Input 
                                type="time" 
                                value={defaultCloseTime}
                                onChange={(e) => setDefaultCloseTime(e.target.value)}
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 md:col-span-2 pt-4 border-t border-slate-100">
                          <h3 className="font-bold text-lg text-slate-900">Características de la Cancha</h3>
                          
                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Tipo de superficie</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Sintética", "Losa", "Grass natural", "Parquet (indoor)"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setSurfaceType(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${surfaceType === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Techo</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Techada", "Sin techo"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setRoofType(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${roofType === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Iluminación</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Con iluminación nocturna", "Sin iluminación"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setLighting(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${lighting === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Tamaño</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Fútbol 5", "Fútbol 7", "Fútbol 11"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setFieldSize(type)}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${fieldSize === type ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-slate-700 font-bold text-sm uppercase tracking-wider">Extras (Puedes elegir varios)</Label>
                            <div className="flex flex-wrap gap-2">
                              {["Vestuarios", "Estacionamiento", "Cafetería / snacks", "Tribuna / graderías", "Baños", "WiFi"].map(extra => (
                                <button
                                  key={extra}
                                  type="button"
                                  onClick={() => {
                                    setExtras(prev => 
                                      prev.includes(extra) ? prev.filter(e => e !== extra) : [...prev, extra]
                                    )
                                  }}
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${extras.includes(extra) ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {extra}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100 flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={() => setActiveView("fields")} className="h-12 px-8 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50">
                          Cancelar
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl text-base font-bold shadow-lg shadow-green-600/20"
                        >
                          {activeView === "new_field" ? "Crear Cancha" : "Guardar Cambios"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </main>

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
                <SelectContent className="z-[100]">
                  <SelectItem value="Problema con un pago/retiro">Problema con un pago/retiro</SelectItem>
                  <SelectItem value="Problema con un jugador">Problema con un jugador</SelectItem>
                  <SelectItem value="Duda sobre comisiones">Duda sobre comisiones</SelectItem>
                  <SelectItem value="Problema técnico">Problema técnico</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Detalles de tu consulta</Label>
              <textarea 
                className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
                placeholder="Explica tu problema detalladamente..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
              ></textarea>
            </div>

            <div className="space-y-2">
              <Label>Adjuntar imagen (Opcional - Máx. 5MB JPG/PNG)</Label>
              {supportImage ? (
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                  <img src={supportImage} alt="Adjunto" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setSupportImage(null)}
                    className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-black text-white rounded-full p-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold cursor-pointer transition-colors w-fit border border-slate-200/60">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span>Seleccionar Imagen</span>
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleSupportImageSelect} />
                </label>
              )}
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

      {/* Map Modal */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-green-600" />
              Seleccionar Ubicación
            </DialogTitle>
            <DialogDescription>
              Haz clic en el mapa para marcar la ubicación exacta de tu local.
            </DialogDescription>
          </DialogHeader>
          
          <div className="h-[400px] rounded-2xl overflow-hidden border border-slate-200 relative z-0">
            <MapContainer 
              center={selectedLocation || [-12.0464, -77.0428]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <LocationMarker />
            </MapContainer>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
            <Button variant="outline" className="w-full sm:w-1/2 rounded-xl" onClick={() => setIsMapModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="w-full sm:w-1/2 rounded-xl bg-green-600 hover:bg-green-700" 
              onClick={() => {
                if (!selectedLocation) {
                  toast.error("Por favor selecciona una ubicación en el mapa");
                  return;
                }
                setIsMapModalOpen(false);
                toast.success("Ubicación seleccionada");
              }}
            >
              Confirmar Ubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              Denunciar Usuario
            </DialogTitle>
            <DialogDescription>
              Si este usuario ha faltado al respeto, solicitado pagos fuera de la plataforma o actuado sospechosamente, repórtalo aquí.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo de la denuncia</Label>
              <Input 
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Ej. Lenguaje inapropiado, falta de respeto, etc."
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsReportModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={handleReportUser} 
              disabled={isSubmittingReport} 
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {isSubmittingReport ? "Enviando..." : "Enviar Denuncia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendario Completo de Reservas Modal */}
      <Dialog open={isFullCalendarOpen} onOpenChange={setIsFullCalendarOpen}>
        <DialogContent className="sm:max-w-3xl rounded-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
              <CalendarDays className="w-6 h-6 text-green-600" />
              Calendario Completo de Reservas
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Consulta todas las reservas pasadas, de hoy y futuras registradas en tus canchas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-slate-600 uppercase">Filtrar por fecha:</Label>
                <Input 
                  type="date"
                  value={calendarSelectedDate}
                  onChange={(e) => setCalendarSelectedDate(e.target.value)}
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs font-bold w-auto"
                />
                {calendarSelectedDate && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCalendarSelectedDate("")}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Ver Todas
                  </Button>
                )}
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-bold w-fit">
                Total: {bookings.filter(b => !calendarSelectedDate || b.date === calendarSelectedDate).length} reservas
              </Badge>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Horario</th>
                      <th className="px-4 py-3">Jugador</th>
                      <th className="px-4 py-3">Cancha</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Código 4 dígitos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings
                      .filter(b => !calendarSelectedDate || b.date === calendarSelectedDate)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-800 text-xs whitespace-nowrap">
                            {b.date ? format(new Date(b.date + 'T00:00:00'), "dd/MM/yyyy") : "N/A"}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 font-semibold whitespace-nowrap">
                            {b.timeSlot || b.time}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-bold text-slate-900 whitespace-nowrap">
                            {b.userName || b.player || "Jugador"}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                            {b.fieldName || b.court}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-black text-slate-900 whitespace-nowrap">
                            S/ {(b.price || b.montoTotal || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <Badge variant="outline" className={`font-bold text-[10px] uppercase px-2 py-0.5
                              ${(b.status === 'Completado' || b.status === 'completed' || b.status === 'Llegó a la cancha') ? 'bg-green-50 text-green-700 border-green-200' : ''}
                              ${(b.status === 'Pago verificado - Esperando llegada' || b.status === 'active' || b.estadoPago === 'Pago verificado - Esperando llegada') ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                              ${(b.status === 'En Verificación' || b.estadoPago === 'pendiente_verificacion') ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                              ${b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                            `}>
                              {(b.status === 'Completado' || b.status === 'completed' || b.status === 'Llegó a la cancha') && 'Completado'}
                              {(b.status === 'Pago verificado - Esperando llegada' || b.status === 'active' || b.estadoPago === 'Pago verificado - Esperando llegada') && 'Esperando llegada'}
                              {(b.status === 'En Verificación' || b.estadoPago === 'pendiente_verificacion') && 'En verificación'}
                              {b.status === 'cancelled' && 'Cancelada'}
                              {!['Completado', 'completed', 'Llegó a la cancha', 'Pago verificado - Esperando llegada', 'active', 'En Verificación', 'pendiente_verificacion', 'cancelled'].includes(b.status) && (b.status || 'Pendiente')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-xs text-purple-700 whitespace-nowrap">
                            {b.securityCode || b.checkInCode || b.codigoLlegada || "—"}
                          </td>
                        </tr>
                      ))}
                    {bookings.filter(b => !calendarSelectedDate || b.date === calendarSelectedDate).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic text-xs">
                          No se encontraron reservas para esta fecha.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
