# StoryAI Helper - 프로젝트 복제 및 개발 가이드

이 문서는 **드라마 보조작가 비서 (StoryAI Helper)** 프로젝트를 다른 환경에서 복제하거나 재구현하기 위한 상세 개발 가이드입니다. 
본 프로젝트는 **Next.js 14**, **Vertex AI (RAG Engine)**, **Google Cloud Storage**, **Supabase**를 기반으로 구축되었습니다.

---

## 1. 기술 스택 (Tech Stack)

*   **Framework**: Next.js 14 (App Router, TypeScript)
*   **Styling**: Tailwind CSS (Dark Mode, Serif/Sans Typography)
*   **AI / RAG**: Google Vertex AI (Gemini Pro, Discovery Engine)
*   **Storage**: Google Cloud Storage (Original Files), Supabase Storage (UI Previews)
*   **Database**: Supabase (PostgreSQL) - 인사이트 저장용
*   **Icons**: Lucide React

---

## 2. 프로젝트 아키텍처 및 데이터 흐름

이 시스템의 핵심은 **"지식(Knowledge)"**과 **"작품(Work)"**을 분리하여 AI에게 제공하는 것입니다.

### 2.1 정보 위계 (Prompt Hierarchy)
AI가 답변을 생성할 때 사용하는 컨텍스트는 다음과 같이 분류됩니다.

1.  **Canon (절대적 사실)**: 사용자가 업로드한 **'대본(Script)'**. 이것은 이미 완료된 결과물이므로 AI는 이를 변경할 수 없습니다.
2.  **Theory (참고 자료)**: 지식저장소에 업로드된 작법 이론서. AI가 작품을 분석하거나 아이디어를 낼 때 도구로 사용합니다.
3.  **Treatment (기획/진행 중)**: 작성 중인 **'트리트먼트'**. AI는 이에 대해 적극적으로 아이디어를 제안하고 발전을 도와야 합니다.

### 2.2 클라우드 저장소 구조 (Google Cloud Storage)
Vertex AI가 데이터를 인덱싱하기 위해 GCS를 Source로 사용합니다.
*   `gs://{bucket_name}/database/`: **지식 파일** (배경 지식)
*   `gs://{bucket_name}/work/scripts/`: **완료된 대본** (Canon)
*   `gs://{bucket_name}/work/treatments/`: **진행 중인 기획** (Canon)

---

## 3. 기능별 구현 가이드

### 3.1 지식 저장소 (Knowledge Base)
사용자가 작법 이론이나 배경 지식 자료를 업로드합니다.

*   **UI 경로**: [/src/app/(main)/knowledge/page.tsx](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/app/%28main%29/knowledge/page.tsx)
*   **API 경로**: [/src/app/api/knowledge/upload/route.ts](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/app/api/knowledge/upload/route.ts)
*   **로직**:
    1.  파일을 **Supabase Storage**에 업로드 (UI 표시용).
    2.  파일을 **Google Cloud Storage** (`database/` 경로)에 업로드.
    3.  **Vertex AI Client** (`importDocuments`)를 호출하여 인덱싱 트리거.

### 3.2 집필 작업실 (Writing Studio) - 핵심 기능
사용자가 자신의 작품(대본/트리트먼트)을 업로드합니다. **PDF 파싱 없이(Native)** 원본을 Vertex AI가 인식하도록 구현되었습니다.

*   **UI 경로**: [/src/app/(main)/work/page.tsx](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/app/%28main%29/work/page.tsx)
    *   탭 구분: '완료된 대본(Scripts)' / '진행 중(Treatments)'
    *   File Upload Component: `.pdf`, [.txt](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/debug_output.txt) 지원
*   **API 경로**: [/src/app/api/work/upload/route.ts](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/app/api/work/upload/route.ts)
*   **핵심 구현 사항 (Native PDF Support)**:
    *   과거에는 `pdf-parse`를 사용했으나, OCR 이슈로 제거됨.
    *   현재는 **GCS에 원본 파일을 그대로 업로드**하고, Vertex AI Import 시 `dataSchema` 옵션을 비워두어 **Auto-Detection**을 유도합니다.
    *   이로 인해 스캔된 PDF나 이미지 기반 문서도 Vertex AI의 OCR이 자동으로 처리합니다.

### 3.3 보조작가 채팅 (Assistant Chat / RAG)
사용자의 질문에 대해 Canon과 Theory를 참조하여 답변합니다.

*   **UI 경로**: [/src/app/(main)/chat/page.tsx](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/app/%28main%29/chat/page.tsx)
*   **RAG 로직 ([src/lib/vertex-ai.ts](file:///d:/ANSSil%20Dropbox/%EB%B0%95%EA%B7%BC%EC%A0%95/%EC%8A%A4%ED%84%B0%EB%94%94-Antigriavity/StoryAI_helper/src/lib/vertex-ai.ts))**:
    1.  **Search**: 사용자 질문으로 Vertex AI Search 실행.
    2.  **Filter & Split**: 검색 결과의 `source` URI를 분석하여 `knowledgeDocs`와 `scriptDocs`로 분리.
        *   `scriptDocs`: URI에 `/work/`가 포함된 문서.
        *   `knowledgeDocs`: 그 외 모든 문서.
    3.  **Context Injection**: 분리된 문서를 시스템 프롬프트의 지정된 섹션에 주입.
    4.  **Generation**: Gemini-Pro 모델이 최종 답변 생성.

---

## 4. 환경 변수 설정 (.env.local)

프로젝트 구동을 위해 다음 환경 변수가 필수적입니다.

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Google Cloud & Vertex AI Configuration
GOOGLE_PROJECT_ID=YOUR_PROJECT_ID
GOOGLE_CLIENT_EMAIL=YOUR_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
VERTEX_AI_DATA_STORE_ID=YOUR_DATA_STORE_ID
```

---

## 5. 데이터베이스 스키마 (Supabase)

인사이트(채팅 결과) 저장을 위한 간단한 테이블 구조입니다.

```sql
create table if not exists saved_insights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  source_title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table saved_insights enable row level security;

create policy "Users can insert their own insights"
  on saved_insights for insert with check (true);

create policy "Users can view their own insights"
  on saved_insights for select using (true);
```

---

## 6. 배포 체크리스트 (Vercel)

1.  **Environment Variables**: Vercel 대시보드에서 위 환경 변수들을 모두 등록해야 합니다. `GOOGLE_PRIVATE_KEY`의 줄바꿈 처리에 주의하세요.
2.  **Service Account 권한**: Google Cloud Service Account는 다음 권한이 필요합니다.
    *   `Storage Object Admin` (GCS 읽기/쓰기)
    *   `Discovery Engine Editor` (Vertex AI Search 관리)
    *   `Vertex AI User` (Gemini 호출)
