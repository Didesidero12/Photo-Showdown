export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          allow_comments: boolean
          class_id: string
          created_at: string
          creative_intent_prompt: string
          experience_mode: Database["public"]["Enums"]["experience_mode"]
          id: string
          instructions: string | null
          max_submissions_per_student: number
          organization_id: string
          reflection_prompt: string | null
          restrict_self_evaluation: boolean
          share_token: string
          status: Database["public"]["Enums"]["assignment_status"]
          submission_deadline: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_comments?: boolean
          class_id: string
          created_at?: string
          creative_intent_prompt?: string
          experience_mode?: Database["public"]["Enums"]["experience_mode"]
          id?: string
          instructions?: string | null
          max_submissions_per_student?: number
          organization_id: string
          reflection_prompt?: string | null
          restrict_self_evaluation?: boolean
          share_token: string
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_deadline?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_comments?: boolean
          class_id?: string
          created_at?: string
          creative_intent_prompt?: string
          experience_mode?: Database["public"]["Enums"]["experience_mode"]
          id?: string
          instructions?: string | null
          max_submissions_per_student?: number
          organization_id?: string
          reflection_prompt?: string | null
          restrict_self_evaluation?: boolean
          share_token?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_deadline?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_memberships: {
        Row: {
          class_id: string
          display_name: string
          id: string
          joined_at: string
          status: Database["public"]["Enums"]["class_member_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          display_name: string
          id?: string
          joined_at?: string
          status?: Database["public"]["Enums"]["class_member_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          display_name?: string
          id?: string
          joined_at?: string
          status?: Database["public"]["Enums"]["class_member_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          archived_at: string | null
          class_code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          teacher_id: string
        }
        Insert: {
          archived_at?: string | null
          class_code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          teacher_id: string
        }
        Update: {
          archived_at?: string | null
          class_code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      critiques: {
        Row: {
          created_at: string
          effect: string
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean | null
          lens_type: string
          matchup_id: string
          notice: string
          selected_submission_id: string
          structured_response: Json | null
          unhidden_at: string | null
          unhidden_by: string | null
        }
        Insert: {
          created_at?: string
          effect: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          lens_type: string
          matchup_id: string
          notice: string
          selected_submission_id: string
          structured_response?: Json | null
          unhidden_at?: string | null
          unhidden_by?: string | null
        }
        Update: {
          created_at?: string
          effect?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          lens_type?: string
          matchup_id?: string
          notice?: string
          selected_submission_id?: string
          structured_response?: Json | null
          unhidden_at?: string | null
          unhidden_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "critiques_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: true
            referencedRelation: "matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critiques_selected_submission_id_fkey"
            columns: ["selected_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      matchups: {
        Row: {
          completed_at: string | null
          created_at: string
          critic_membership_id: string
          id: string
          sequence_number: number
          session_id: string
          submission_a_id: string
          submission_b_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          critic_membership_id: string
          id?: string
          sequence_number?: number
          session_id: string
          submission_a_id: string
          submission_b_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          critic_membership_id?: string
          id?: string
          sequence_number?: number
          session_id?: string
          submission_a_id?: string
          submission_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchups_critic_membership_id_fkey"
            columns: ["critic_membership_id"]
            isOneToOne: false
            referencedRelation: "class_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_submission_a_id_fkey"
            columns: ["submission_a_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_submission_b_id_fkey"
            columns: ["submission_b_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          status: Database["public"]["Enums"]["org_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          status?: Database["public"]["Enums"]["org_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          status?: Database["public"]["Enums"]["org_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_anonymous: boolean
          profile_complete: boolean
          school: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_anonymous?: boolean
          profile_complete?: boolean
          school?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_anonymous?: boolean
          profile_complete?: boolean
          school?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          reset_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
        }
        Relationships: []
      }
      recovery_codes: {
        Row: {
          class_membership_id: string
          code_hash: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          class_membership_id: string
          code_hash: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          class_membership_id?: string
          code_hash?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recovery_codes_class_membership_id_fkey"
            columns: ["class_membership_id"]
            isOneToOne: false
            referencedRelation: "class_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participations: {
        Row: {
          class_membership_id: string
          created_at: string
          critiques_required: number
          id: string
          override_active: boolean
          override_actor_id: string | null
          override_reason: string | null
          override_timestamp: string | null
          session_id: string
        }
        Insert: {
          class_membership_id: string
          created_at?: string
          critiques_required?: number
          id?: string
          override_active?: boolean
          override_actor_id?: string | null
          override_reason?: string | null
          override_timestamp?: string | null
          session_id: string
        }
        Update: {
          class_membership_id?: string
          created_at?: string
          critiques_required?: number
          id?: string
          override_active?: boolean
          override_actor_id?: string | null
          override_reason?: string | null
          override_timestamp?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participations_class_membership_id_fkey"
            columns: ["class_membership_id"]
            isOneToOne: false
            referencedRelation: "class_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participations_override_actor_id_fkey"
            columns: ["override_actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_submissions: {
        Row: {
          added_at: string
          session_id: string
          submission_id: string
        }
        Insert: {
          added_at?: string
          session_id: string
          submission_id: string
        }
        Update: {
          added_at?: string
          session_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      showdown_sessions: {
        Row: {
          assignment_id: string
          closed_at: string | null
          created_at: string
          id: string
          lens_type: string
          pilot_analytics: Json | null
          reveal_critic_identity: boolean
          reveal_intent: boolean
          reveal_peer_critiques: boolean
          reveal_photographer_identity: boolean
          reveal_votes: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["showdown_session_status"]
          teacher_id: string
        }
        Insert: {
          assignment_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          lens_type?: string
          pilot_analytics?: Json | null
          reveal_critic_identity?: boolean
          reveal_intent?: boolean
          reveal_peer_critiques?: boolean
          reveal_photographer_identity?: boolean
          reveal_votes?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["showdown_session_status"]
          teacher_id: string
        }
        Update: {
          assignment_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          lens_type?: string
          pilot_analytics?: Json | null
          reveal_critic_identity?: boolean
          reveal_intent?: boolean
          reveal_peer_critiques?: boolean
          reveal_photographer_identity?: boolean
          reveal_votes?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["showdown_session_status"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showdown_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showdown_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          class_membership_id: string
          created_at: string
          creative_intent: string
          id: string
          organization_id: string
          previous_submission_id: string | null
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["processing_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          revision_number: number
          status: Database["public"]["Enums"]["submission_status"]
          storage_path_processed: string | null
          storage_path_raw: string | null
          submitted_at: string
          teacher_note: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          class_membership_id: string
          created_at?: string
          creative_intent: string
          id?: string
          organization_id: string
          previous_submission_id?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["processing_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_number?: number
          status?: Database["public"]["Enums"]["submission_status"]
          storage_path_processed?: string | null
          storage_path_raw?: string | null
          submitted_at?: string
          teacher_note?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          class_membership_id?: string
          created_at?: string
          creative_intent?: string
          id?: string
          organization_id?: string
          previous_submission_id?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["processing_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_number?: number
          status?: Database["public"]["Enums"]["submission_status"]
          storage_path_processed?: string | null
          storage_path_raw?: string | null
          submitted_at?: string
          teacher_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_class_membership_id_fkey"
            columns: ["class_membership_id"]
            isOneToOne: false
            referencedRelation: "class_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_previous_submission_id_fkey"
            columns: ["previous_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_matchup_rpc: {
        Args: { p_critic_membership_id: string; p_session_id: string }
        Returns: string
      }
      claim_recovery_code: {
        Args: { provided_code_hash: string }
        Returns: Json
      }
      generate_class_code: { Args: never; Returns: string }
      generate_recovery_code: { Args: never; Returns: string }
      generate_share_token: { Args: never; Returns: string }
      increment_rate_limit: {
        Args: { p_key: string; p_window_interval: string }
        Returns: number
      }
      increment_session_coaching_trigger: {
        Args: { p_session_id: string; p_trigger_type: string }
        Returns: undefined
      }
      initiate_submission: {
        Args: { p_assignment_id: string; p_creative_intent: string }
        Returns: {
          is_revision: boolean
          raw_path: string
          submission_id: string
        }[]
      }
      toggle_critique_hidden: {
        Args: { p_critique_id: string; p_is_hidden: boolean; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      assignment_status:
        | "draft"
        | "accepting_submissions"
        | "submission_review"
        | "ready"
        | "active_critique"
        | "results_reveal"
        | "reflection"
        | "complete"
        | "archived"
      class_member_status: "active" | "suspended" | "removed"
      experience_mode: "quick_showdown" | "critique_studio"
      org_member_role: "owner" | "teacher"
      org_member_status: "active" | "suspended" | "removed"
      processing_status: "pending" | "processing" | "ready" | "failed"
      showdown_session_status: "preparing" | "active" | "reveal" | "closed"
      submission_status: "pending" | "approved" | "returned" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assignment_status: [
        "draft",
        "accepting_submissions",
        "submission_review",
        "ready",
        "active_critique",
        "results_reveal",
        "reflection",
        "complete",
        "archived",
      ],
      class_member_status: ["active", "suspended", "removed"],
      experience_mode: ["quick_showdown", "critique_studio"],
      org_member_role: ["owner", "teacher"],
      org_member_status: ["active", "suspended", "removed"],
      processing_status: ["pending", "processing", "ready", "failed"],
      showdown_session_status: ["preparing", "active", "reveal", "closed"],
      submission_status: ["pending", "approved", "returned", "rejected"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

