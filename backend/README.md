# Cosmic_Matrix - Backend Core Infrastructure API v4.5

Este repositorio contiene el motor de servicios y persistencia de datos para el **SaaS Core Infrastructure Monitor (Cosmic_Matrix)**. Diseñado como una micro-API REST ultraligera, centraliza las operaciones del clúster corporativo y sincroniza el estado de los nodos directamente en una base de datos PostgreSQL alojada en la nube.

---

## 🚀 Arquitectura y Tecnologías

El backend está construido con un stack óptimo para garantizar velocidad de respuesta, despliegue continuo y un consumo mínimo de recursos:

* **Entorno de Ejecución:** Node.js (v18+)
* **Framework Web:** Express.js (Arquitectura REST)
* **Base de Datos:** PostgreSQL (Driver nativo `pg`)
* **Seguridad / Integración:** CORS habilitado para comunicación directa entre dominios.
* **Infraestructura de Nube:** Render (Web Service + PostgreSQL)

---

## 🛠️ Requisitos Previos

Antes de levantar el servidor localmente, asegúrate de tener instalado:
* [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
* Una instancia local de PostgreSQL o una cadena de conexión remota válida (`DATABASE_URL`).

---

## 📦 Instalación y Configuración Local

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/cosmic-matrix-back.git](https://github.com/tu-usuario/cosmic-matrix-back.git)
    cd cosmic-matrix-back
    ```

2.  **Instalar dependencias de producción:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del proyecto (o configura las variables en tu terminal) con los siguientes parámetros:
    ```env
    PORT=3000
    DATABASE_URL=postgresql://usuario:password@localhost:5432/cosmic_db
    ```

4
