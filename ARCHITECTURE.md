flowchart TD
    %% Define the User
    User([Youth User on Mobile]) --> |Visits URL| Vercel

    %% Hosting Layer
    subgraph Hosting [Hosting & CDN]
        Vercel[Vercel Static Hosting\n(index.html, sw.js, manifest)]
    end

    %% Client Layer
    Vercel --> |Loads App| Client
    subgraph Client [Client Side - Browser]
        Client[ Vanilla JS PWA]
        LocalStorage[(LocalStorage\nGuest Mode & Sensitive Data)]
        Client <--> LocalStorage
    end

    %% Backend Layer
    Client --> |HTTPS API Calls| Supabase
    subgraph Backend [Supabase Backend]
        Auth[Supabase Auth\nPKCE Flow]
        DB[(PostgreSQL Database\nRow Level Security)]
        Edge[Edge Functions\nTranslation API]
    end

    %% External API
    Edge --> |API Call| Gemini[Gemini AI\n(Translations only)]
    
    %% Styling
    classDef frontend fill:#E3EDE4,stroke:#0F4D36,stroke-width:2px;
    classDef backend fill:#FFC244,stroke:#6B4A00,stroke-width:2px;
    classDef storage fill:#FBF6EE,stroke:#E6DDCD,stroke-width:2px;
    classDef external fill:#F1EADD,stroke:#5F6B63,stroke-width:2px;
    
    class Client frontend;
    class Auth,DB,Edge backend;
    class LocalStorage storage;
    class Gemini external;
