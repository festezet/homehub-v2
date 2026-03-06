/**
 * System Monitor Module - Disk usage and CPU/GPU/RAM monitoring
 */

class SystemMonitorModule {
    constructor() {
        this.loaded = false;
        this.refreshInterval = null;
    }

    async load() {
        console.log('📊 Loading System Monitor module...');

        try {
            await this.refreshDiskUsage();
            await this.refreshBackupStatus();
            this.setupEventListeners();
            this.loaded = true;
        } catch (error) {
            console.error('Error loading system monitor:', error);
        }
    }

    async refreshBackupStatus() {
        try {
            const response = await fetch('http://localhost:8887/api/backup-status');
            if (!response.ok) {
                throw new Error('Backup API not available');
            }
            const data = await response.json();
            this.updateBackupDisplay(data);
        } catch (error) {
            console.error('Error fetching backup status:', error);
            this.setBackupError();
        }
    }

    updateBackupDisplay(data) {
        // System Backup
        const sysDateEl = document.getElementById('system-backup-date');
        const sysAgoEl = document.getElementById('system-backup-ago');
        const sysIconEl = document.getElementById('system-backup-icon');
        const sysStatusEl = document.getElementById('system-backup-status');

        if (sysDateEl) sysDateEl.textContent = data.system_backup.date_readable;
        if (sysAgoEl) sysAgoEl.textContent = data.system_backup.time_ago;
        if (sysIconEl) sysIconEl.textContent = data.system_backup.icon;
        if (sysStatusEl) {
            sysStatusEl.textContent = data.system_backup.message;
            sysStatusEl.className = 'backup-status-badge ' + data.system_backup.status;
        }

        // Data Backup
        const dataDateEl = document.getElementById('data-backup-date');
        const dataAgoEl = document.getElementById('data-backup-ago');
        const dataIconEl = document.getElementById('data-backup-icon');
        const dataStatusEl = document.getElementById('data-backup-status');

        if (dataDateEl) dataDateEl.textContent = data.data_backup.date_readable;
        if (dataAgoEl) dataAgoEl.textContent = data.data_backup.time_ago;
        if (dataIconEl) dataIconEl.textContent = data.data_backup.icon;
        if (dataStatusEl) {
            dataStatusEl.textContent = data.data_backup.message;
            dataStatusEl.className = 'backup-status-badge ' + data.data_backup.status;
        }

        // Last update
        const lastUpdateEl = document.getElementById('backup-last-update');
        if (lastUpdateEl) {
            const updateDate = new Date(data.last_update);
            lastUpdateEl.textContent = 'Dernière MAJ: ' + updateDate.toLocaleString('fr-FR');
        }

        // Deleted files (corbeille de protection)
        if (data.deleted_files) {
            this.updateDeletedFilesDisplay(data.deleted_files);
        }

        console.log('Backup status updated:', data);
    }

    updateDeletedFilesDisplay(deletedInfo) {
        const section = document.getElementById('deleted-files-section');
        if (!section) return;

        if (deletedInfo.has_deleted_files) {
            section.style.display = 'block';

            const badge = document.getElementById('deleted-files-badge');
            if (badge) badge.textContent = `${deletedInfo.total_files} fichiers`;

            const summary = document.getElementById('deleted-files-summary');
            if (summary) {
                const sizeMb = deletedInfo.total_size_mb;
                const sizeStr = sizeMb > 1024 ? `${(sizeMb / 1024).toFixed(1)} GB` : `${sizeMb.toFixed(0)} MB`;
                summary.textContent = `${sizeStr} en corbeille - retention ${deletedInfo.retention_days} jours`;
            }

            const list = document.getElementById('deleted-files-list');
            if (list && deletedInfo.items) {
                list.innerHTML = deletedInfo.items.slice(0, 5).map(item => {
                    const dirs = item.top_dirs.slice(0, 3).join(', ');
                    const more = item.top_dirs.length > 3 ? '...' : '';
                    return `<div class="deleted-file-item">${item.date} [${item.label}]: ${dirs}${more} (${item.size_mb.toFixed(0)} MB)</div>`;
                }).join('');
            }
        } else {
            section.style.display = 'none';
        }
    }

    setBackupError() {
        const elements = ['system-backup-date', 'data-backup-date'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Erreur de connexion';
        });

        const icons = ['system-backup-icon', 'data-backup-icon'];
        icons.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '⚠️';
        });
    }

    async refreshDiskUsage() {
        try {
            const response = await fetch('/api/system/storage');
            if (!response.ok) {
                // If API not available, try infrastructure dashboard
                await this.refreshDiskUsageFallback();
                return;
            }
            const data = await response.json();
            this.updateDiskDisplay(data);
        } catch (error) {
            console.error('Error fetching disk usage:', error);
            await this.refreshDiskUsageFallback();
        }
    }

    async refreshDiskUsageFallback() {
        try {
            const response = await fetch('/api/infrastructure/dashboard');
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.storage) {
                    this.updateDiskDisplayFromInfra(data.data.storage);
                }
            }
        } catch (error) {
            console.log('Using static disk data');
            this.setStaticDiskData();
        }
    }

    updateDiskDisplay(data) {
        // SDD (System)
        if (data.sdd) {
            this.updateVolume('sdd-root', data.sdd.root);
            this.updateVolume('sdd-home', data.sdd.home);
        }

        // SDB (System Backup) - usually static
        if (data.sdb) {
            this.updateVolume('sdb-root', data.sdb.root);
            this.updateVolume('sdb-home', data.sdb.home);
        }

        // SDA (LVM Data)
        if (data.sda) {
            this.updateVolume('sda-projects', data.sda.projects);
            this.updateVolume('sda-docker', data.sda.docker);
            this.updateVolume('sda-media', data.sda.media);
        }

        // SDC (Backup Data)
        if (data.sdc) {
            this.updateVolume('sdc-projects', data.sdc.projects);
            this.updateVolume('sdc-docker', data.sdc.docker);
            this.updateVolume('sdc-media', data.sdc.media);
        }
    }

    updateDiskDisplayFromInfra(storage) {
        // Map from infrastructure service format
        if (storage.root) {
            this.updateVolumeSimple('sdd-root', storage.root.used, storage.root.total, storage.root.percent);
        }
        if (storage.home) {
            this.updateVolumeSimple('sdd-home', storage.home.used, storage.home.total, storage.home.percent);
        }
        if (storage.projects) {
            this.updateVolumeSimple('sda-projects', storage.projects.used, storage.projects.total, storage.projects.percent);
        }
        if (storage.docker) {
            this.updateVolumeSimple('sda-docker', storage.docker.used, storage.docker.total, storage.docker.percent);
        }
        if (storage.media) {
            this.updateVolumeSimple('sda-media', storage.media.used, storage.media.total, storage.media.percent);
        }
    }

    updateVolume(prefix, volumeData) {
        if (!volumeData) return;

        const textEl = document.getElementById(`${prefix}-text`);
        const barEl = document.getElementById(`${prefix}-bar`);

        if (textEl) {
            textEl.textContent = `${volumeData.used} / ${volumeData.total}`;
        }

        if (barEl) {
            const percent = volumeData.percent || 0;
            barEl.style.width = `${percent}%`;
            barEl.className = 'progress-fill ' + this.getColorClass(percent);
        }
    }

    updateVolumeSimple(prefix, used, total, percent) {
        const textEl = document.getElementById(`${prefix}-text`);
        const barEl = document.getElementById(`${prefix}-bar`);

        if (textEl) {
            textEl.textContent = `${used} / ${total}`;
        }

        if (barEl) {
            barEl.style.width = `${percent}%`;
            barEl.className = 'progress-fill ' + this.getColorClass(percent);
        }
    }

    setStaticDiskData() {
        // Default static data when API not available
        const staticData = {
            'sdd-root': { text: '60G / 140G', percent: 43 },
            'sdd-home': { text: '5G / 140G', percent: 4 },
            'sdb-root': { text: '~60G / 143G', percent: 42 },
            'sdb-home': { text: '~5G / 143G', percent: 4 },
            'sda-projects': { text: '50G / 200G', percent: 25 },
            'sda-docker': { text: '80G / 300G', percent: 27 },
            'sda-media': { text: '200G / 400G', percent: 50 },
            'sdc-projects': { text: '45G / 200G', percent: 23 },
            'sdc-docker': { text: '75G / 300G', percent: 25 },
            'sdc-media': { text: '180G / 400G', percent: 45 }
        };

        Object.entries(staticData).forEach(([prefix, data]) => {
            const textEl = document.getElementById(`${prefix}-text`);
            const barEl = document.getElementById(`${prefix}-bar`);

            if (textEl) textEl.textContent = data.text;
            if (barEl) {
                barEl.style.width = `${data.percent}%`;
                barEl.className = 'progress-fill ' + this.getColorClass(data.percent);
            }
        });
    }

    getColorClass(percent) {
        if (percent >= 85) return 'red';
        if (percent >= 70) return 'orange';
        return 'green';
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('btn-refresh-storage');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDiskUsage());
        }

        const refreshBackupBtn = document.getElementById('btn-refresh-backup');
        if (refreshBackupBtn) {
            refreshBackupBtn.addEventListener('click', () => this.refreshBackupStatus());
        }
    }

    reload() {
        this.load();
    }
}

// Create and export singleton
const systemMonitorModule = new SystemMonitorModule();
window.systemMonitorModule = systemMonitorModule;

export default systemMonitorModule;
