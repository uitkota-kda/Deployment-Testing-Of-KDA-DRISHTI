import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Default Icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function ProjectMap({ projects, height = "100%" }) {
  const KOTA_CENTER = [25.1767, 75.8333];
  const validProjects = projects.filter(p => p.gpsLat && p.gpsLong);
  const center = validProjects.length > 0 ? [validProjects[0].gpsLat, validProjects[0].gpsLong] : KOTA_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: height, width: '100%', borderRadius: '1rem' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {validProjects.map(project => (
        <Marker key={project.id} position={[project.gpsLat, project.gpsLong]}>
          <Popup>
            <div style={{ padding: '5px', minWidth: '150px' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>{project.name}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  <span style={{ fontWeight: 600 }}>Progress:</span> {project.currentProgress}%
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  <span style={{ fontWeight: 600 }}>Status:</span> {project.overallStatus}
                </p>
                <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                <a
                  href={`/projects/${project.id}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '6px',
                    background: 'var(--primary)',
                    color: 'white',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}
                >
                  VIEW DETAILS
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
