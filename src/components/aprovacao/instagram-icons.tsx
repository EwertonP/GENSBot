import React from 'react';

export interface InstagramIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  filled?: boolean;
}

/**
 * Selo Oficial de Verificado da Meta / Instagram (Starburst octogonal azul com check centralizado)
 * Extraído diretamente do design system vetorial do Figma.
 */
export function InstagramVerifiedBadge({ size = 16, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Perfil verificado"
      role="img"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M9.07763 4.32994L8 3.5L6.92237 4.32994L5.56712 4.21436L5.10926 5.49516L3.90666 6.13063L4.21393 7.45565L3.5458 8.64042L4.52066 9.58896L4.59913 10.9469L5.93205 11.2178L6.7322 12.3177L8 11.825L9.2678 12.3177L10.068 11.2178L11.4009 10.9469L11.4793 9.58896L12.4542 8.64042L11.7861 7.45565L12.0933 6.13063L10.8907 5.49516L10.4329 4.21436L9.07763 4.32994ZM6.85355 7.64645C6.65829 7.45118 6.34171 7.45118 6.14645 7.64645C5.95118 7.84171 5.95118 8.15829 6.14645 8.35355L7.14645 9.35355C7.34171 9.54882 7.65829 9.54882 7.85355 9.35355L9.85355 7.35355C10.0488 7.15829 10.0488 6.84171 9.85355 6.64645C9.65829 6.45118 9.34171 6.45118 9.14645 6.64645L7.5 8.29289L6.85355 7.64645Z"
        fill="#0098FD"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Like (Coração) - Traço fiel ou preenchido vermelho Instagram
 */
export function InstagramHeartIcon({ size = 24, filled = false, className = '', ...props }: InstagramIconProps) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
        {...props}
      >
        <path
          d="M11.9513 21.0026C11.6913 21.0026 11.4313 20.9426 11.2113 20.7726C8.55131 18.8326 5.78131 16.6926 3.73131 13.7526C3.01131 12.7126 2.04131 11.1026 2.00131 9.06261C1.95131 6.61261 3.34131 4.36261 5.46131 3.44261C7.59131 2.52261 10.1213 3.06261 11.9113 4.82261L11.9913 4.90261C12.0713 4.82261 12.1513 4.74261 12.2313 4.67261C14.2313 2.85261 17.0213 2.49261 19.1513 3.77261C21.3613 5.10261 22.4413 7.84261 21.8013 10.4526C21.2313 12.7426 19.8313 14.4826 18.5313 15.8926C16.7513 17.8126 14.6713 19.4126 12.8713 20.7226C12.6513 20.8826 12.3013 21.0126 11.9413 21.0126L11.9513 21.0026Z"
          fill="#FF0034"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M11.9513 21.0026C11.6913 21.0026 11.4313 20.9426 11.2113 20.7726C8.55131 18.8326 5.78131 16.6926 3.73131 13.7526C3.01131 12.7126 2.04131 11.1026 2.00131 9.06261C1.95131 6.61261 3.34131 4.36261 5.46131 3.44261C7.59131 2.52261 10.1213 3.06261 11.9113 4.82261L11.9913 4.90261C12.0713 4.82261 12.1513 4.74261 12.2313 4.67261C14.2313 2.85261 17.0213 2.49261 19.1513 3.77261C21.3613 5.10261 22.4413 7.84261 21.8013 10.4526C21.2313 12.7426 19.8313 14.4826 18.5313 15.8926C16.7513 17.8126 14.6713 19.4126 12.8713 20.7226C12.6513 20.8826 12.3013 21.0126 11.9413 21.0126L11.9513 21.0026ZM7.62131 5.00261C7.15131 5.00261 6.69131 5.09261 6.26131 5.28261C4.88131 5.88261 3.97131 7.38261 4.00131 9.02261C4.02131 10.1726 4.45131 11.2826 5.37131 12.6126C7.14131 15.1626 9.60131 17.1126 12.0013 18.8826C13.7213 17.6226 15.5113 16.2226 17.0713 14.5326C18.2513 13.2526 19.4113 11.8126 19.8713 9.97261C20.3113 8.21261 19.5913 6.37261 18.1313 5.49261C16.7413 4.65261 14.9513 4.91261 13.5813 6.16261C13.3913 6.33261 13.2113 6.53261 13.0413 6.72261L12.0513 7.76261L10.5113 6.26261C9.68131 5.45261 8.63131 5.01261 7.61131 5.01261L7.62131 5.00261Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Comentário (Balão de Fala com ponta diagonal inferior direita)
 */
export function InstagramCommentIcon({ size = 24, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19C13.3137 19 14.54 18.6391 15.5886 18.0116C15.8209 17.8726 16.0995 17.8337 16.361 17.9037L18.4741 18.4699L17.9074 16.3548C17.8374 16.0937 17.8762 15.8153 18.0148 15.5833C18.6403 14.5358 19 13.3114 19 12C19 8.13401 15.866 5 12 5ZM3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 13.528 20.6184 14.9694 19.9449 16.2316L20.8543 19.6253C20.9468 19.9704 20.8481 20.3386 20.5955 20.5913C20.3428 20.8439 19.9746 20.9426 19.6295 20.8501L16.2382 19.9414C14.9745 20.6171 13.5307 21 12 21C7.02944 21 3 16.9706 3 12Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Envio / Compartilhar (Avião de Papel / Seta 2026)
 */
export function InstagramShareIcon({ size = 24, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M8.00005 12.4995L14 8.99951M8.00005 12.4995L9.4321 18.8005C9.82668 20.5367 12.1226 20.9306 13.0733 19.4253L20.5623 7.56801C21.4034 6.23627 20.4528 4.5 18.8776 4.5C15.1389 4.5 9.17515 4.5 4.25765 4.5C2.41858 4.5 1.55744 6.77309 2.93201 7.99486L8.00005 12.4995Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Salvar / Bookmark (Marcador de Página)
 */
export function InstagramSaveIcon({ size = 24, filled = false, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {filled ? (
        <path
          d="M19.271 21.1703C19.5605 21.4115 20 21.2057 20 20.8289V2.22222H4V20.8289C4 21.2057 4.43949 21.4115 4.72897 21.1703L12 15.1111L19.271 21.1703Z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M12 15.1111L19.271 21.1703C19.5605 21.4115 20 21.2057 20 20.8289V2.22222H4V20.8289C4 21.2057 4.43949 21.4115 4.72897 21.1703L12 15.1111ZM6 17.5077L10.7196 13.5747C11.4613 12.9566 12.5387 12.9566 13.2804 13.5747L18 17.5077V4.22222H6V17.5077Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      )}
    </svg>
  );
}

/**
 * Ícone Oficial de Opções (3 Pontos Horizontais)
 */
export function InstagramOptionsIcon({ size = 24, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M7 13.5C7.82843 13.5 8.5 12.8284 8.5 12C8.5 11.1716 7.82843 10.5 7 10.5C6.17157 10.5 5.5 11.1716 5.5 12C5.5 12.8284 6.17157 13.5 7 13.5Z"
        fill="currentColor"
      />
      <path
        d="M13.5 12C13.5 12.8284 12.8284 13.5 12 13.5C11.1716 13.5 10.5 12.8284 10.5 12C10.5 11.1716 11.1716 10.5 12 10.5C12.8284 10.5 13.5 11.1716 13.5 12Z"
        fill="currentColor"
      />
      <path
        d="M18.5 12C18.5 12.8284 17.8284 13.5 17 13.5C16.1716 13.5 15.5 12.8284 15.5 12C15.5 11.1716 16.1716 10.5 17 10.5C17.8284 10.5 18.5 11.1716 18.5 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Repost (Setas de recirculação)
 */
export function InstagramRepostIcon({ size = 24, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M10.793 1.79297C11.1835 1.40244 11.8165 1.40244 12.207 1.79297L15.707 5.29297C16.0975 5.6835 16.0975 6.31652 15.707 6.70703L12.207 10.207C11.8165 10.5975 11.1835 10.5975 10.793 10.207C10.4025 9.81652 10.4025 9.1835 10.793 8.79297L12.5859 7H8.5C6.84315 7 5.5 8.34315 5.5 10V13.5C5.49996 14.0522 5.05226 14.5 4.5 14.5C3.94774 14.5 3.50004 14.0522 3.5 13.5V10C3.5 7.23858 5.73858 5 8.5 5H12.5859L10.793 3.20703C10.4025 2.81652 10.4025 2.1835 10.793 1.79297Z"
        fill="currentColor"
      />
      <path
        d="M13.207 22.207C12.8164 22.5975 12.1834 22.5975 11.7929 22.207L8.29291 18.707C7.90242 18.3164 7.9024 17.6834 8.29291 17.2929L11.7929 13.7929C12.1834 13.4024 12.8165 13.4024 13.207 13.7929C13.5975 14.1834 13.5975 14.8164 13.207 15.207L11.414 16.9999H15.4999C17.1568 16.9999 18.4999 15.6568 18.4999 13.9999V10.4999C18.5 9.94767 18.9477 9.49992 19.4999 9.49992C20.0522 9.49992 20.4999 9.94767 20.4999 10.4999V13.9999C20.4999 16.7613 18.2614 18.9999 15.4999 18.9999H11.414L13.207 20.7929C13.5975 21.1834 13.5975 21.8164 13.207 22.207Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Reels 2026 (Clapperboard moderno)
 */
export function InstagramReelsIcon({ size = 24, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 9.42578C8 7.75368 9.86447 6.26074 11.6455 7.35254L15.8457 9.92676L15.9854 10.0195C17.3382 10.979 17.3382 13.021 15.9854 13.9805L15.8457 14.0732L11.6455 16.6475C9.86446 17.7393 8 16.2463 8 14.5742V9.42578ZM10.5996 9.05762C10.3497 8.90468 10.0417 9.07428 10.0039 9.36523L10 9.42578V14.5742L10.0039 14.6348C10.0391 14.9063 10.3098 15.072 10.5488 14.9688L10.5996 14.9424L14.7998 12.3682C15.0665 12.2047 15.0665 11.7953 14.7998 11.6318L10.5996 9.05762Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.3086 2.00781C19.4789 2.16843 22 4.78979 22 8V16L21.9922 16.3086C21.8368 19.3767 19.3767 21.8368 16.3086 21.9922L16 22H8C4.78979 22 2.16843 19.4789 2.00781 16.3086L2 16V8C2 4.68629 4.68629 2 8 2H16L16.3086 2.00781ZM8 4C5.79086 4 4 5.79086 4 8V16C4 18.2091 5.79086 20 8 20H16C18.2091 20 20 18.2091 20 16V8C20 5.79086 18.2091 4 16 4H8Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Carrossel (Gallery - Quadrados Sobrepostos)
 */
export function InstagramGalleryIcon({ size = 16, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M0 2C0 0.895431 0.895431 0 2 0H9C10.1046 0 11 0.895431 11 2V9C11 10.1046 10.1046 11 9 11H2C0.895431 11 0 10.1046 0 9V2Z"
        fill="currentColor"
      />
      <path
        d="M14 3.5C14 2.67157 13.3284 2 12.5 2V9.5C12.5 11.1569 11.1569 12.5 9.5 12.5H2C2 13.3284 2.67157 14 3.5 14H10C12.2091 14 14 12.2091 14 10V3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Áudio / Som (Equalizador 3 barras)
 */
export function InstagramAudioWaveIcon({ size = 16, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M6 1.75C6 0.783502 6.7835 0 7.75 0C8.7165 0 9.5 0.783502 9.5 1.75V14.25C9.5 15.2165 8.7165 16 7.75 16C6.7835 16 6 15.2165 6 14.25V1.75Z"
        fill="currentColor"
      />
      <path
        d="M12 5.75C12 4.7835 12.7835 4 13.75 4C14.7165 4 15.5 4.7835 15.5 5.75V10.25C15.5 11.2165 14.7165 12 13.75 12C12.7835 12 12 11.2165 12 10.25V5.75Z"
        fill="currentColor"
      />
      <path
        d="M0 5.75C0 4.7835 0.783502 4 1.75 4C2.7165 4 3.5 4.7835 3.5 5.75V10.25C3.5 11.2165 2.7165 12 1.75 12C0.783502 12 0 11.2165 0 10.25V5.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ícone Oficial de Nota Musical
 */
export function InstagramMusicNoteIcon({ size = 14, className = '', ...props }: InstagramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 9 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <path
        d="M9 0L2.5 1V6.66841C2.27269 6.56042 2.0184 6.5 1.75 6.5C0.783502 6.5 0 7.2835 0 8.25C0 9.2165 0.783502 10 1.75 10C2.7165 10 3.5 9.2165 3.5 8.25V3.84615L8 3.15385V5.66841C7.77269 5.56042 7.5184 5.5 7.25 5.5C6.2835 5.5 5.5 6.2835 5.5 7.25C5.5 8.2165 6.2835 9 7.25 9C8.2165 9 9 8.2165 9 7.25V0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Anel Oficial de Story Novo do Instagram (Gradiente oficial da Meta)
 */
export function InstagramStoryGradientRing({ size = 42, className = '', children }: { size?: number; className?: string; children?: React.ReactNode }) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 pointer-events-none"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ig-story-gradient)"
          strokeWidth={strokeWidth}
        />
        <defs>
          <linearGradient id="ig-story-gradient" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7638FA" />
            <stop offset="17%" stopColor="#D300C5" />
            <stop offset="36%" stopColor="#FF0069" />
            <stop offset="62.5%" stopColor="#FF7A00" />
            <stop offset="83.5%" stopColor="#FFD600" />
          </linearGradient>
        </defs>
      </svg>
      {children}
    </div>
  );
}
