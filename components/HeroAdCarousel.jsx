
"use client";

import { useEffect, useState } from "react";

const ads = [
    {
        image: "https://scontent.fbkk28-1.fna.fbcdn.net/v/t39.30808-6/670484320_1268792195355388_2613126696101760984_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=7b2446&_nc_ohc=mogVbmpz_FEQ7kNvwGQu4Ei&_nc_oc=AdqGYmURayRJmkccvtrlDnXxM6xC6pBDTvhIfgVeOJhuyG8C5v77gKeKZn_eV8JM76Y&_nc_zt=23&_nc_ht=scontent.fbkk28-1.fna&_nc_gid=GYruXD_TZ60ts7RTWYzZww&_nc_ss=7b2a8&oh=00_Af32JFbpHZLL3xN2FVNpmnv0Yf_mKhTzVkXkmPG9cmofyA&oe=69F663F5",
        title: "โปรโมชันยางรถยนต์",
    },
    {
        image: "https://scontent.fbkk28-1.fna.fbcdn.net/v/t39.30808-6/635831659_1225519303016011_1144877148104790714_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=13d280&_nc_ohc=NhGwwfJuu6cQ7kNvwGlfdKx&_nc_oc=AdoIXu3L-79U9O3q4oEQrxtvGeCykrPZC1j2l9UeB18lCetpGMSQBc6YlM4xnYEtnHg&_nc_zt=23&_nc_ht=scontent.fbkk28-1.fna&_nc_gid=B3CBFTaa1MPFVSlTO66_sg&_nc_ss=7b2a8&oh=00_Af3Z2SUGgtzwzIy_bpvGs352McLT0qzqINE0uuSMv71BHQ&oe=69F66721",
        title: "บริการติดตั้งถึงบ้าน",
    },
    {
        image: "/static/images/ads/ad-3.jpg",
        title: "รับประกัน 365 วัน",
    },
];

export default function HeroAdCarousel() {
    const [active, setActive] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setActive((prev) => (prev + 1) % ads.length);
        }, 4500);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="hero-ad-carousel">
            {ads.map((item, index) => (
                <div
                    key={item.image}
                    className={`hero-ad-slide ${index === active ? "active" : ""}`}
                >
                    <img src={item.image} alt={item.title} />
                </div>
            ))}

            <div className="hero-ad-dots">
                {ads.map((item, index) => (
                    <button
                        key={item.image}
                        type="button"
                        className={index === active ? "active" : ""}
                        onClick={() => setActive(index)}
                        aria-label={`slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}