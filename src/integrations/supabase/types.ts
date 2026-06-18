export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string;
          appointment_time: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          doctor_id: string | null;
          id: string;
          notes: string | null;
          patient_id: string | null;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
          updated_by: string | null;
          visit_reason: string | null;
        };
        Insert: {
          appointment_date: string;
          appointment_time: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id?: string | null;
          id?: string;
          notes?: string | null;
          patient_id?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
          updated_by?: string | null;
          visit_reason?: string | null;
        };
        Update: {
          appointment_date?: string;
          appointment_time?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id?: string | null;
          id?: string;
          notes?: string | null;
          patient_id?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
          updated_by?: string | null;
          visit_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_status_history: {
        Row: {
          appointment_id: string;
          changed_at: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          new_status: Database["public"]["Enums"]["appointment_status"];
          old_status: Database["public"]["Enums"]["appointment_status"] | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          appointment_id: string;
          changed_at?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          new_status: Database["public"]["Enums"]["appointment_status"];
          old_status?: Database["public"]["Enums"]["appointment_status"] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          appointment_id?: string;
          changed_at?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          new_status?: Database["public"]["Enums"]["appointment_status"];
          old_status?: Database["public"]["Enums"]["appointment_status"] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_profile: {
        Row: {
          address: string | null;
          consultation_fee: number;
          created_at: string;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          phone: string | null;
          updated_at: string;
          working_hours: Json;
        };
        Insert: {
          address?: string | null;
          consultation_fee?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          working_hours?: Json;
        };
        Update: {
          address?: string | null;
          consultation_fee?: number;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          working_hours?: Json;
        };
        Relationships: [];
      };
      doctor_leaves: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          doctor_id: string;
          end_date: string;
          id: string;
          reason: string | null;
          start_date: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id: string;
          end_date: string;
          id?: string;
          reason?: string | null;
          start_date: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id?: string;
          end_date?: string;
          id?: string;
          reason?: string | null;
          start_date?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "doctor_leaves_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
        ];
      };
      doctors: {
        Row: {
          consultation_fee: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          specialization: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          working_hours: Json;
        };
        Insert: {
          consultation_fee?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          specialization: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          working_hours?: Json;
        };
        Update: {
          consultation_fee?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          specialization?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          working_hours?: Json;
        };
        Relationships: [];
      };
      document_entity_links: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          document_id: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["document_entity_type"];
          id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          document_id: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["document_entity_type"];
          id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          document_id?: string;
          entity_id?: string;
          entity_type?: Database["public"]["Enums"]["document_entity_type"];
          id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_entity_links_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "patient_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_encounters: {
        Row: {
          appointment_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          doctor_id: string;
          encounter_type: Database["public"]["Enums"]["encounter_type"];
          ended_at: string | null;
          id: string;
          notes: string | null;
          patient_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["encounter_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id: string;
          encounter_type?: Database["public"]["Enums"]["encounter_type"];
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          patient_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["encounter_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          doctor_id?: string;
          encounter_type?: Database["public"]["Enums"]["encounter_type"];
          ended_at?: string | null;
          id?: string;
          notes?: string | null;
          patient_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["encounter_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_encounters_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_encounters_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_encounters_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          document_type: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          mime_type: string;
          notes: string | null;
          patient_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          document_type?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          mime_type: string;
          notes?: string | null;
          patient_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          document_type?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string;
          notes?: string | null;
          patient_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_medical_notes: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          note: string;
          patient_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          note: string;
          patient_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          note?: string;
          patient_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_medical_notes_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      prescription_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          dosage: string;
          duration: string;
          frequency: string;
          id: string;
          medicine_name: string;
          notes: string | null;
          prescription_id: string;
          quantity: string | null;
          route: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dosage: string;
          duration: string;
          frequency: string;
          id?: string;
          medicine_name: string;
          notes?: string | null;
          prescription_id: string;
          quantity?: string | null;
          route?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dosage?: string;
          duration?: string;
          frequency?: string;
          id?: string;
          medicine_name?: string;
          notes?: string | null;
          prescription_id?: string;
          quantity?: string | null;
          route?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey";
            columns: ["prescription_id"];
            isOneToOne: false;
            referencedRelation: "prescriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      prescription_template_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          dosage: string;
          duration: string;
          frequency: string;
          id: string;
          medicine_name: string;
          notes: string | null;
          quantity: string | null;
          route: string | null;
          template_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dosage: string;
          duration: string;
          frequency: string;
          id?: string;
          medicine_name: string;
          notes?: string | null;
          quantity?: string | null;
          route?: string | null;
          template_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dosage?: string;
          duration?: string;
          frequency?: string;
          id?: string;
          medicine_name?: string;
          notes?: string | null;
          quantity?: string | null;
          route?: string | null;
          template_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prescription_template_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "prescription_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      prescription_templates: {
        Row: {
          chief_complaint: string | null;
          clinical_notes: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          diagnosis: string | null;
          doctor_id: string | null;
          id: string;
          instructions: string | null;
          is_system: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          chief_complaint?: string | null;
          clinical_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          diagnosis?: string | null;
          doctor_id?: string | null;
          id?: string;
          instructions?: string | null;
          is_system?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          chief_complaint?: string | null;
          clinical_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          diagnosis?: string | null;
          doctor_id?: string | null;
          id?: string;
          instructions?: string | null;
          is_system?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prescription_templates_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
        ];
      };
      prescriptions: {
        Row: {
          chief_complaint: string | null;
          clinical_notes: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          diagnosis: string | null;
          doctor_id: string;
          encounter_id: string;
          id: string;
          instructions: string | null;
          patient_id: string;
          prescription_number: string;
          status: Database["public"]["Enums"]["prescription_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          chief_complaint?: string | null;
          clinical_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          diagnosis?: string | null;
          doctor_id: string;
          encounter_id: string;
          id?: string;
          instructions?: string | null;
          patient_id: string;
          prescription_number?: string;
          status?: Database["public"]["Enums"]["prescription_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          chief_complaint?: string | null;
          clinical_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          diagnosis?: string | null;
          doctor_id?: string;
          encounter_id?: string;
          id?: string;
          instructions?: string | null;
          patient_id?: string;
          prescription_number?: string;
          status?: Database["public"]["Enums"]["prescription_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prescriptions_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey";
            columns: ["encounter_id"];
            isOneToOne: false;
            referencedRelation: "patient_encounters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          address: string | null;
          allergies: string | null;
          blood_group: string | null;
          created_at: string;
          created_by: string | null;
          current_medications: string | null;
          date_of_birth: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          dob: string | null;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          first_name: string;
          full_name: string;
          gender: string | null;
          id: string;
          last_name: string;
          medical_history: string | null;
          notes: string | null;
          patient_code: string;
          phone: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string | null;
          allergies?: string | null;
          blood_group?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_medications?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dob?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name: string;
          full_name?: string;
          gender?: string | null;
          id?: string;
          last_name: string;
          medical_history?: string | null;
          notes?: string | null;
          patient_code?: string;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          allergies?: string | null;
          blood_group?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_medications?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dob?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name?: string;
          full_name?: string;
          gender?: string | null;
          id?: string;
          last_name?: string;
          medical_history?: string | null;
          notes?: string | null;
          patient_code?: string;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      patient_statistics: {
        Row: {
          completed_appointments: number;
          last_visit_date: string | null;
          patient_id: string;
          total_appointments: number;
          upcoming_appointments: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      prepare_patient_record: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      ensure_patient_document_patient_link: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      next_prescription_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      prepare_prescription_record: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      set_audit_fields: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      app_role: "admin" | "doctor" | "receptionist";
      appointment_status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
      document_entity_type:
        | "patient"
        | "encounter"
        | "prescription"
        | "invoice"
        | "lab_report"
        | "admission";
      encounter_status: "planned" | "in_progress" | "completed" | "cancelled";
      encounter_type: "opd" | "follow_up" | "teleconsultation" | "emergency" | "ipd";
      prescription_status: "draft" | "finalized" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "doctor", "receptionist"],
      appointment_status: ["scheduled", "confirmed", "completed", "cancelled", "no_show"],
      document_entity_type: [
        "patient",
        "encounter",
        "prescription",
        "invoice",
        "lab_report",
        "admission",
      ],
      encounter_status: ["planned", "in_progress", "completed", "cancelled"],
      encounter_type: ["opd", "follow_up", "teleconsultation", "emergency", "ipd"],
      prescription_status: ["draft", "finalized", "cancelled"],
    },
  },
} as const;
