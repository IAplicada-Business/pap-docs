export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          created_at: string
          evento: string
          id: string
          org_id: string
          payload: Json | null
          usuario: string | null
        }
        Insert: {
          created_at?: string
          evento: string
          id?: string
          org_id: string
          payload?: Json | null
          usuario?: string | null
        }
        Update: {
          created_at?: string
          evento?: string
          id?: string
          org_id?: string
          payload?: Json | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          deleted_at: string | null
          email_contato: string | null
          id: string
          nome: string | null
          nome_fantasia: string | null
          org_id: string
          origem_documentos: string[]
          painel_token: string | null
          razao_social: string | null
          segmento: string | null
          status: string
          telefone: string | null
          updated_at: string
          upload_token: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          deleted_at?: string | null
          email_contato?: string | null
          id?: string
          nome?: string | null
          nome_fantasia?: string | null
          org_id: string
          origem_documentos?: string[]
          painel_token?: string | null
          razao_social?: string | null
          segmento?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          upload_token?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          deleted_at?: string | null
          email_contato?: string | null
          id?: string
          nome?: string | null
          nome_fantasia?: string | null
          org_id?: string
          origem_documentos?: string[]
          painel_token?: string | null
          razao_social?: string | null
          segmento?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          upload_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      competencias: {
        Row: {
          cliente_id: string
          created_at: string
          deleted_at: string | null
          fechada_em: string | null
          fechada_por: string | null
          id: string
          mes_ano: string
          org_id: string
          status: string
          taxa_conciliacao: number | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          deleted_at?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes_ano: string
          org_id: string
          status?: string
          taxa_conciliacao?: number | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          deleted_at?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes_ano?: string
          org_id?: string
          status?: string
          taxa_conciliacao?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          arquivo_path: string | null
          cliente_id: string
          competencia_id: string | null
          created_at: string
          deleted_at: string | null
          enviado_em: string
          erro_motivo: string | null
          hash: string | null
          hash_sha256: string | null
          id: string
          nome_original: string | null
          org_id: string
          origem: string | null
          publicado_painel: boolean
          status_processamento: string
          tamanho_bytes: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          cliente_id: string
          competencia_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enviado_em?: string
          erro_motivo?: string | null
          hash?: string | null
          hash_sha256?: string | null
          id?: string
          nome_original?: string | null
          org_id: string
          origem?: string | null
          publicado_painel?: boolean
          status_processamento?: string
          tamanho_bytes?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          cliente_id?: string
          competencia_id?: string | null
          created_at?: string
          deleted_at?: string | null
          enviado_em?: string
          erro_motivo?: string | null
          hash?: string | null
          hash_sha256?: string | null
          id?: string
          nome_original?: string | null
          org_id?: string
          origem?: string | null
          publicado_painel?: boolean
          status_processamento?: string
          tamanho_bytes?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          cliente_id: string
          competencia_id: string
          confianca_ia: number | null
          conta_credito: string | null
          conta_debito: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string | null
          documento_id: string | null
          id: string
          org_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          competencia_id: string
          confianca_ia?: number | null
          conta_credito?: string | null
          conta_debito?: string | null
          created_at?: string
          data: string
          deleted_at?: string | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          org_id: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          competencia_id?: string
          confianca_ia?: number | null
          conta_credito?: string | null
          conta_debito?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          org_id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_credito_fkey"
            columns: ["conta_credito"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_debito_fkey"
            columns: ["conta_debito"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cor_primaria: string
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          cor_primaria?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          cor_primaria?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      plano_contas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          deleted_at: string | null
          descricao: string
          id: string
          org_id: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          deleted_at?: string | null
          descricao: string
          id?: string
          org_id: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string
          id?: string
          org_id?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          nome: string | null
          org_id: string
          papel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
          org_id: string
          papel?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          org_id?: string
          papel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_aprendizado: {
        Row: {
          aplicacoes: number
          cliente_id: string
          conta_destino: string | null
          created_at: string
          deleted_at: string | null
          id: string
          org_id: string
          origem_regra: string | null
          padrao_descricao: string
          updated_at: string
        }
        Insert: {
          aplicacoes?: number
          cliente_id: string
          conta_destino?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id: string
          origem_regra?: string | null
          padrao_descricao: string
          updated_at?: string
        }
        Update: {
          aplicacoes?: number
          cliente_id?: string
          conta_destino?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id?: string
          origem_regra?: string | null
          padrao_descricao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_aprendizado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_aprendizado_conta_destino_fkey"
            columns: ["conta_destino"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_aprendizado_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          arquivo_path: string | null
          competencia_id: string
          created_at: string
          deleted_at: string | null
          enviado_em: string | null
          id: string
          org_id: string
          publicado_painel: boolean
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          competencia_id: string
          created_at?: string
          deleted_at?: string | null
          enviado_em?: string | null
          id?: string
          org_id: string
          publicado_painel?: boolean
          tipo: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          competencia_id?: string
          created_at?: string
          deleted_at?: string | null
          enviado_em?: string | null
          id?: string
          org_id?: string
          publicado_painel?: boolean
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
