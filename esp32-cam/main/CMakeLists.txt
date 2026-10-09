idf_component_register(
    SRCS "main.cpp"
    PRIV_REQUIRES esp_event esp_netif esp_psram esp_timer esp_wifi nvs_flash
    EMBED_TXTFILES "../bench/certs/ca.pem"
)
