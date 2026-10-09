#include <atomic>
#include <cstdint>
#include <cstring>
#include <string_view>

#include "esp_camera.h"
#include "esp_event.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "esp_psram.h"
#include "esp_timer.h"
#include "esp_websocket_client.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static_assert(sizeof(CONFIG_BENCH_WIFI_SSID) > 1, "BENCH_WIFI_SSID is empty: set it with idf.py menuconfig");
static_assert(sizeof(CONFIG_BENCH_WIFI_PASSWORD) > 1, "BENCH_WIFI_PASSWORD is empty: set it with idf.py menuconfig");
static_assert(std::string_view(CONFIG_BENCH_SERVER_URI).starts_with("wss://"),
              "BENCH_SERVER_URI must start with wss://: set it with idf.py menuconfig");

static const char *const LOG_TAG = "camera";

static std::atomic<bool> wifi_connected = false;
static std::atomic<int64_t> network_restored_at_us = 0;
static std::atomic<int64_t> channel_opening_since_us = 0;

static void handle_network_event(void *, esp_event_base_t event_base, int32_t event_id, void *)
{
    constexpr int64_t awaiting_network = -1;

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
        return;
    }
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (wifi_connected.exchange(false)) {
            ESP_LOGW(LOG_TAG, "wifi disconnected");
            network_restored_at_us = awaiting_network;
        }
        esp_wifi_connect();
        return;
    }
    if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        wifi_connected = true;
        wifi_ap_record_t access_point = {};
        esp_wifi_sta_get_ap_info(&access_point);
        ESP_LOGI(LOG_TAG, "wifi connected rssi=%d channel=%u bssid=" MACSTR, access_point.rssi,
                 static_cast<unsigned>(access_point.primary), MAC2STR(access_point.bssid));
        if (network_restored_at_us == awaiting_network) {
            network_restored_at_us = esp_timer_get_time();
        }
    }
}

static void handle_channel_event(void *, esp_event_base_t, int32_t event_id, void *)
{
    if (event_id == WEBSOCKET_EVENT_BEFORE_CONNECT) {
        channel_opening_since_us = esp_timer_get_time();
        return;
    }
    if (event_id == WEBSOCKET_EVENT_CONNECTED) {
        int64_t opening_since_us = channel_opening_since_us.exchange(0);
        ESP_LOGI(LOG_TAG, "channel open_ms=%lld", (esp_timer_get_time() - opening_since_us) / 1000);
        return;
    }
    if (event_id == WEBSOCKET_EVENT_ERROR || event_id == WEBSOCKET_EVENT_DISCONNECTED) {
        if (channel_opening_since_us.exchange(0) != 0) {
            ESP_LOGE(LOG_TAG, "websocket connect failed");
        }
    }
}

static void start_wifi()
{
    esp_err_t nvs_status = nvs_flash_init();
    if (nvs_status == ESP_ERR_NVS_NO_FREE_PAGES || nvs_status == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_status = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs_status);

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t driver_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&driver_config));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, handle_network_event, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, handle_network_event, nullptr));

    wifi_config_t station_config = {};
    strlcpy(reinterpret_cast<char *>(station_config.sta.ssid), CONFIG_BENCH_WIFI_SSID,
            sizeof(station_config.sta.ssid));
    strlcpy(reinterpret_cast<char *>(station_config.sta.password), CONFIG_BENCH_WIFI_PASSWORD,
            sizeof(station_config.sta.password));
    station_config.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
    station_config.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &station_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
}

static void start_camera()
{
    camera_config_t ai_thinker = {};
    ai_thinker.pin_pwdn = 32;
    ai_thinker.pin_reset = -1;
    ai_thinker.pin_xclk = 0;
    ai_thinker.pin_sccb_sda = 26;
    ai_thinker.pin_sccb_scl = 27;
    ai_thinker.pin_d7 = 35;
    ai_thinker.pin_d6 = 34;
    ai_thinker.pin_d5 = 39;
    ai_thinker.pin_d4 = 36;
    ai_thinker.pin_d3 = 21;
    ai_thinker.pin_d2 = 19;
    ai_thinker.pin_d1 = 18;
    ai_thinker.pin_d0 = 5;
    ai_thinker.pin_vsync = 25;
    ai_thinker.pin_href = 23;
    ai_thinker.pin_pclk = 22;
    ai_thinker.xclk_freq_hz = 20'000'000;
    ai_thinker.ledc_timer = LEDC_TIMER_0;
    ai_thinker.ledc_channel = LEDC_CHANNEL_0;
    ai_thinker.pixel_format = PIXFORMAT_JPEG;
    ai_thinker.frame_size = FRAMESIZE_VGA;
    ai_thinker.jpeg_quality = 12;
    ai_thinker.fb_count = 1;
    ai_thinker.fb_location = CAMERA_FB_IN_PSRAM;
    ai_thinker.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    ESP_ERROR_CHECK(esp_camera_init(&ai_thinker));
}

static esp_websocket_client_handle_t start_channel()
{
    extern const char bench_ca_pem[] asm("_binary_ca_pem_start");

    esp_websocket_client_config_t channel_config = {};
    channel_config.uri = CONFIG_BENCH_SERVER_URI;
    channel_config.cert_pem = bench_ca_pem;
    channel_config.reconnect_timeout_ms = 2000;
    channel_config.network_timeout_ms = 10000;

    esp_websocket_client_handle_t channel = esp_websocket_client_init(&channel_config);
    configASSERT(channel);
    ESP_ERROR_CHECK(esp_websocket_register_events(channel, WEBSOCKET_EVENT_ANY, handle_channel_event, nullptr));
    ESP_ERROR_CHECK(esp_websocket_client_start(channel));
    return channel;
}

static size_t free_internal_heap()
{
    return heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
}

extern "C" void app_main()
{
    ESP_LOGI(LOG_TAG, "psram bytes=%u", static_cast<unsigned>(esp_psram_get_size()));
    start_camera();
    start_wifi();
    while (!wifi_connected) {
        vTaskDelay(pdMS_TO_TICKS(100));
    }
    esp_websocket_client_handle_t channel = start_channel();

    uint32_t frame_sequence = 0;
    TickType_t last_frame_tick = xTaskGetTickCount();
    while (true) {
        xTaskDelayUntil(&last_frame_tick, pdMS_TO_TICKS(2000));
        if (!esp_websocket_client_is_connected(channel)) {
            continue;
        }

        size_t heap_before = free_internal_heap();
        camera_fb_t *frame = esp_camera_fb_get();
        if (frame == nullptr) {
            ESP_LOGE(LOG_TAG, "frame capture failed");
            continue;
        }
        size_t frame_bytes = frame->len;
        int sent_bytes = esp_websocket_client_send_bin(channel, reinterpret_cast<const char *>(frame->buf),
                                                       static_cast<int>(frame_bytes), pdMS_TO_TICKS(10000));
        esp_camera_fb_return(frame);
        if (sent_bytes != static_cast<int>(frame_bytes)) {
            int signal_dbm = 0;
            esp_wifi_sta_get_rssi(&signal_dbm);
            ESP_LOGE(LOG_TAG, "frame send failed rssi=%d", signal_dbm);
            continue;
        }

        frame_sequence += 1;
        ESP_LOGI(LOG_TAG, "frame seq=%u bytes=%u heap_before=%u heap_after=%u heap_min=%u",
                 static_cast<unsigned>(frame_sequence), static_cast<unsigned>(frame_bytes),
                 static_cast<unsigned>(heap_before), static_cast<unsigned>(free_internal_heap()),
                 static_cast<unsigned>(heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL)));

        int64_t restored_at_us = network_restored_at_us;
        if (restored_at_us > 0 && network_restored_at_us.compare_exchange_strong(restored_at_us, 0)) {
            ESP_LOGI(LOG_TAG, "reconnected network_to_frame_ms=%lld", (esp_timer_get_time() - restored_at_us) / 1000);
        }
    }
}
